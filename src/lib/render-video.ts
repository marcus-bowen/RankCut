"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export type RenderClip = { id: string; rank: number; file: File; start: number; end: number; label: string };
export type RenderTitleToken = { text: string; color: string };
export type RenderOptions = { clips: RenderClip[]; title: RenderTitleToken[]; onProgress: (progress: number) => void; onStatus: (status: string) => void };

// Generate text as SVG→PNG in the browser. FFmpeg therefore needs no system fonts.
async function makeOverlay(title: RenderTitleToken[], entries: { rank: number; label: string }[], highlight: number, revealedRanks: number[]): Promise<Uint8Array> {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
  const titleText = title.map((token) => `<tspan fill="${esc(token.color)}">${esc(token.text)}</tspan>`).join("&#160;");
  const list = [...entries].sort((a, b) => a.rank - b.rank).map((item, i) => {
    const y = 340 + i * 87, active = item.rank === highlight;
    const number = `<text x="55" y="${y}" font-family="Arial,sans-serif" font-size="70" font-weight="900" fill="${active ? "#ffcb05" : "#ffffff"}" stroke="#050505" stroke-width="7" paint-order="stroke">${item.rank}.</text>`;
    const caption = revealedRanks.includes(item.rank) ? `<text x="185" y="${y - 5}" font-family="Arial,sans-serif" font-size="44" font-weight="900" fill="#ffffff" stroke="#101114" stroke-width="5" paint-order="stroke">${esc(item.label || `Rank ${item.rank}`)}</text>` : "";
    return number + caption;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000" stop-opacity=".65"/><stop offset=".20" stop-color="#000" stop-opacity=".15"/><stop offset=".62" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="1080" height="700" fill="url(#shade)"/><text x="540" y="173" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="68" font-weight="1000" fill="#fff" stroke="#08090b" stroke-width="12" paint-order="stroke" style="filter:drop-shadow(0px 8px 5px #000)">${titleText}</text>${list}</svg>`;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not render text overlay")); image.src = url; });
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Could not encode overlay")), "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}

/** Render each trimmed shot with its rank overlay, then join into a portrait MP4. */
export async function renderVerticalVideo(ffmpeg: FFmpeg, options: RenderOptions): Promise<Blob> {
  const { clips, title, onProgress, onStatus } = options;
  const ranked = clips;
  const concatLines: string[] = [];
  let currentIndex = 0;
  let joining = false;
  ffmpeg.on("progress", ({ progress }) => {
    const fraction = Math.min(1, Math.max(0, progress));
    onProgress(joining ? Math.min(99, Math.round(85 + fraction * 14)) : Math.min(85, Math.round(((currentIndex + fraction) / ranked.length) * 85)));
  });
  for (let i = 0; i < ranked.length; i++) {
    const clip = ranked[i];
    currentIndex = i;
    onStatus(`Rendering clip ${i + 1} of ${ranked.length}…`);
    onProgress(Math.round((i / ranked.length) * 85));
    const inputName = `input_${i}.bin`, overlayName = `overlay_${i}.png`, outputName = `part_${i}.mp4`;
    await ffmpeg.writeFile(inputName, await fetchFile(clip.file));
    // Only include captions whose clips have started by this point. Since this
    // overlay is baked into each later segment, revealed entries stay visible.
    await ffmpeg.writeFile(overlayName, await makeOverlay(title, ranked, clip.rank, ranked.slice(0, i + 1).map((entry) => entry.rank)));
    const duration = Math.max(0.1, clip.end - clip.start);
    await ffmpeg.exec([
      "-ss", String(clip.start), "-i", inputName, "-loop", "1", "-i", overlayName,
      "-t", String(duration), "-filter_complex",
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]",
      "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
      "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", outputName
    ]);
    concatLines.push(`file '${outputName}'`);
    onProgress(Math.round(((i + 1) / ranked.length) * 85));
  }
  joining = true;
  onProgress(85);
  onStatus("Joining clips…");
  await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(concatLines.join("\n")));
  await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "-movflags", "+faststart", "rankcut-export.mp4"]);
  onProgress(99); onStatus("Finishing MP4…");
  const bytes = await ffmpeg.readFile("rankcut-export.mp4");
  onProgress(100); onStatus("Export ready");
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "video/mp4" });
}
