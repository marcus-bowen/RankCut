"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Clapperboard, Download, Film, GripVertical, HelpCircle, ImagePlus, Layers, Link2, MoreHorizontal, Pause, Play, Plus, Scissors, Settings2, Sparkles, Trash2, Upload, Volume2, WandSparkles, X } from "lucide-react";
import { renderVerticalVideo } from "@/lib/render-video";
import { getStoredProject, listStoredProjects, saveStoredProject, type StoredProject } from "@/lib/project-storage";

type Clip = { id: string; rank: number; name: string; file: File | null; url: string; duration: number; start: number; end: number; label: string };
type Project = Pick<StoredProject, "id" | "name" | "createdAt" | "updatedAt" | "clipCount">;
const initial: Clip[] = Array.from({ length: 5 }, (_, i) => ({ id: crypto.randomUUID(), rank: 5 - i, name: "", file: null, url: "", duration: 8, start: 0, end: 8, label: ["Most unexpected ending", "Perfect timing", "Wait for it", "No way that happened", "The winner"][i] }));
const fmt = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

export default function Page() {
  const [dashboard, setDashboard] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState("All changes saved");
  const [clips, setClips] = useState<Clip[]>(initial);
  const [title, setTitle] = useState("TOP 5 CRAZIEST MOMENTS");
  const [titleColors, setTitleColors] = useState<string[]>([]);
  const titleWords = title.trim().split(/\s+/).filter(Boolean);
  const coloredTitle = titleWords.map((text, index) => ({ text, color: titleColors[index] || "#ffffff" }));
  const [playhead, setPlayhead] = useState(0), [playing, setPlaying] = useState(false), [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState(0), [exporting, setExporting] = useState(false), [status, setStatus] = useState("");
  const [dragging, setDragging] = useState<number | null>(null), [panel, setPanel] = useState<"clips" | "style">("clips");
  const [uploadTarget, setUploadTarget] = useState<string | null>(null), [uploadDialog, setUploadDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null), fileRefs = useRef<Record<string, HTMLInputElement | null>>({}), modalFileRef = useRef<HTMLInputElement>(null), ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null);
  useEffect(() => { void listStoredProjects().then((saved) => setProjects(saved)).catch((error) => console.warn("Could not load project list", error)); }, []);
  const persistProjects = (next: Project[]) => setProjects(next);
  const startNewProject = () => {
    const now = Date.now(), project: Project = { id: crypto.randomUUID(), name: "Untitled countdown", createdAt: now, updatedAt: now, clipCount: 5 };
    persistProjects([project, ...projects]); setProjectId(project.id); setTitle("TOP 5 CRAZIEST MOMENTS"); setTitleColors([]); setClips(initial.map((clip) => ({ ...clip, id: crypto.randomUUID() }))); setPlayhead(0); setPlaying(false); setDashboard(false);
  };
  const openProject = async (project: Project) => {
    setSaveState("Loading project…");
    try {
      const saved = await getStoredProject(project.id);
      if (saved) {
        setTitle(saved.title); setTitleColors(saved.titleColors);
        setClips(saved.clips.map((clip) => ({ ...clip, url: clip.file ? URL.createObjectURL(clip.file) : "" })));
        setPlayhead(0);
      } else setTitle(project.name);
      setProjectId(project.id); setDashboard(false); setSaveState("All changes saved");
    } catch { setSaveState("Could not load project"); }
  };
  const goToDashboard = () => {
    if (projectId) {
      const updatedAt = Date.now(), name = title.trim() || "Untitled countdown";
      const snapshot: StoredProject = { id: projectId, name, createdAt: projects.find((p) => p.id === projectId)?.createdAt ?? updatedAt, updatedAt, clipCount: clips.length, title, titleColors, clips: clips.map(({ url: _url, ...clip }) => clip) };
      void saveStoredProject(snapshot).then(() => setProjects((old) => [snapshot, ...old.filter((p) => p.id !== projectId)])).catch((error) => { console.error(error); setSaveState("Save failed — check browser storage"); });
    }
    setDashboard(true); setPlaying(false);
  };
  useEffect(() => {
    if (!projectId || dashboard) return;
    setSaveState("Saving…");
    const timer = window.setTimeout(() => {
      const updatedAt = Date.now(), name = title.trim() || "Untitled countdown";
      const snapshot: StoredProject = { id: projectId, name, createdAt: projects.find((p) => p.id === projectId)?.createdAt ?? updatedAt, updatedAt, clipCount: clips.length, title, titleColors, clips: clips.map(({ url: _url, ...clip }) => clip) };
      void saveStoredProject(snapshot).then(() => { setSaveState("All changes saved"); setProjects((old) => [snapshot, ...old.filter((p) => p.id !== projectId)]); }).catch((error) => { console.error(error); setSaveState("Save failed — check browser storage"); });
    }, 600);
    return () => clearTimeout(timer);
  }, [projectId, dashboard, title, titleColors, clips]);
  const total = useMemo(() => clips.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0), [clips]);
  const activeIndex = useMemo(() => { let t = playhead; for (let i = 0; i < clips.length; i++) { const d = clips[i].end - clips[i].start; if (t < d || i === clips.length - 1) return i; t -= d; } return 0; }, [clips, playhead]);
  const active = clips[activeIndex];
  const ranks = [...clips].sort((a, b) => a.rank - b.rank);

  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setPlayhead((t) => t + 0.08 >= total ? 0 : t + 0.08), 80); return () => clearInterval(timer); }, [playing, total]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.url) return;
    const clipOffset = clips.slice(0, activeIndex).reduce((sum, clip) => sum + clip.end - clip.start, 0);
    video.currentTime = active.start + Math.max(0, playhead - clipOffset);
    if (playing) void video.play().catch(() => {}); else video.pause();
  }, [activeIndex, active?.url, active?.start, playing]);
  useEffect(() => () => clips.forEach((c) => { if (c.url) URL.revokeObjectURL(c.url); }), []);

  const updateClip = (id: string, patch: Partial<Clip>) => setClips((old) => old.map((c) => c.id === id ? { ...c, ...patch } : c));
  const addFiles = (list: FileList | null, id?: string) => {
    if (!list?.length) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("video/")).slice(0, id ? 1 : Math.max(0, 10 - clips.length));
    if (!incoming.length) return;
    const create = (file: File, rank: number): Clip => ({ id: crypto.randomUUID(), rank, name: file.name, file, url: URL.createObjectURL(file), duration: 10, start: 0, end: 10, label: "Add a caption" });
    incoming.forEach((file) => { const probe = document.createElement("video"); probe.preload = "metadata"; probe.src = URL.createObjectURL(file); probe.onloadedmetadata = () => { const duration = Number.isFinite(probe.duration) ? probe.duration : 10; setClips((old) => old.map((c) => c.name === file.name && c.file === file ? { ...c, duration, end: duration } : c)); URL.revokeObjectURL(probe.src); }; });
    if (id) { const next = incoming[0]; const current = clips.find((c) => c.id === id)!; const fresh = create(next, current.rank); setClips((old) => old.map((c) => c.id === id ? { ...fresh, label: c.label } : c)); }
    else { const count = incoming.length; setClips((old) => [...old.map((c) => ({ ...c, rank: c.rank + count })), ...incoming.map((file, i) => create(file, count - i))].slice(0, 10)); }
  };
  const reorder = (from: number, to: number) => setClips((old) => { const copy = [...old], [item] = copy.splice(from, 1); copy.splice(to, 0, item); return copy; });
  const exportVideo = async () => {
    if (clips.length < 2 || clips.some((c) => !c.file)) { setStatus("Add a video to every slot before exporting."); return; }
    setExporting(true); setProgress(1); setStatus("Starting browser renderer…");
    try {
      if (!ffmpegRef.current) {
        const { FFmpeg } = await import("@ffmpeg/ffmpeg"); const { toBlobURL } = await import("@ffmpeg/util");
        const ffmpeg = new FFmpeg();
        const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
        await ffmpeg.load({ coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"), wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm") });
        ffmpegRef.current = ffmpeg;
      }
      const blob = await renderVerticalVideo(ffmpegRef.current, { clips: clips.map((c) => ({ id: c.id, rank: c.rank, file: c.file!, start: c.start, end: c.end, label: c.label })), title: coloredTitle, onProgress: setProgress, onStatus: setStatus });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "rankcut-countdown.mp4"; link.click(); URL.revokeObjectURL(link.href);
    } catch (error) { console.error(error); setStatus(error instanceof Error ? error.message : "Export failed. Try fewer or shorter clips."); }
    finally { setExporting(false); }
  };

  if (dashboard) return <main className="min-h-screen bg-[#101114] text-white">
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#292a31] bg-[#101114]/90 px-6 backdrop-blur"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#c8f169] text-black"><Clapperboard size={18}/></div><span className="text-lg font-semibold tracking-tight">rankcut</span><span className="hidden rounded-md border border-[#34353d] px-2 py-1 text-[10px] uppercase tracking-widest text-[#888994] sm:inline">Studio</span></div><div className="text-xs text-[#858691]">Your creative workspace</div></header>
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-[#333630] bg-[radial-gradient(ellipse_at_85%_20%,rgba(200,241,105,.22),transparent_35%),linear-gradient(125deg,#20221d,#17181c_55%,#20231a)] p-7 sm:p-11"><div className="relative z-10 max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#596345] bg-black/20 px-3 py-1.5 text-xs text-[#d4ef9c]"><Sparkles size={13}/> Short-form video studio</div><h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Make your next<br/><span className="text-[#c8f169]">countdown hit.</span></h1><p className="mt-4 max-w-lg text-sm leading-6 text-[#b0b1b8]">Arrange your clips, shape the hook, and build a vertical ranking video ready for Shorts, Reels, and TikTok.</p><button onClick={startNewProject} className="mt-7 rounded-xl bg-[#c8f169] px-5 py-3 text-sm font-bold text-[#16180f] shadow-lg shadow-[#c8f169]/10 transition hover:bg-[#d7fb86]"><Plus size={16} className="mr-2 inline"/>Start new project</button></div><div className="pointer-events-none absolute -bottom-24 -right-6 hidden h-[390px] w-[220px] rotate-[9deg] rounded-[34px] border border-white/15 bg-[#121316] p-2 shadow-2xl sm:block"><div className="relative h-full overflow-hidden rounded-[27px] bg-[linear-gradient(160deg,#545751,#232522_50%,#35382e)]"><div className="absolute inset-x-0 top-0 h-1/5 bg-[#282828]"/><div className="absolute top-[5%] w-full text-center text-xs font-black text-white">TOP MOMENTS</div><div className="absolute left-3 top-1/4 space-y-4 text-2xl font-black text-white [text-shadow:2px_2px_#000]">1.<br/>2.<br/>3.<br/>4.</div><div className="absolute bottom-0 h-1/2 w-full bg-[radial-gradient(ellipse_at_bottom,rgba(200,241,105,.2),transparent)]"/></div></div></section>
      <section className="mt-11"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-xl font-semibold tracking-tight">Your projects</h2><p className="mt-1 text-sm text-[#858691]">Pick up where you left off.</p></div><span className="rounded-lg bg-[#202127] px-2.5 py-1.5 text-xs text-[#a8a9b1]">{projects.length} {projects.length === 1 ? "project" : "projects"}</span></div>
      {projects.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.map((project, i) => <button key={project.id} onClick={() => openProject(project)} className="group overflow-hidden rounded-2xl border border-[#2d2e35] bg-[#18191e] text-left transition hover:-translate-y-0.5 hover:border-[#69764e] hover:bg-[#1c1e20]"><div className={`relative h-36 overflow-hidden ${i % 3 === 0 ? "bg-[linear-gradient(135deg,#45473e,#24262a_55%,#5a4435)]" : i % 3 === 1 ? "bg-[linear-gradient(135deg,#303b42,#25242c_55%,#59533b)]" : "bg-[linear-gradient(135deg,#4a3d37,#27272c_55%,#343d32)]"}`}><div className="absolute inset-x-0 top-0 h-12 bg-black/35"/><div className="absolute top-3 w-full px-5 text-center text-sm font-black uppercase tracking-wide text-white [text-shadow:0_2px_5px_#000]">{project.name}</div><div className="absolute bottom-3 left-4 flex gap-1">{Array.from({ length: Math.min(project.clipCount, 6) }, (_, n) => <span key={n} className="grid h-7 w-7 place-items-center rounded-md border border-white/25 bg-black/30 text-xs font-bold text-[#c8f169]">{n + 1}</span>)}</div><span className="absolute bottom-3 right-4 rounded-md bg-black/45 px-2 py-1 text-[10px] text-white/80">9:16</span></div><div className="flex items-center justify-between p-4"><div className="min-w-0"><h3 className="truncate text-sm font-medium group-hover:text-[#d8f59d]">{project.name}</h3><p className="mt-1 text-xs text-[#858691]">Updated {new Date(project.updatedAt).toLocaleDateString()}</p></div><span className="ml-3 rounded-md bg-[#26272d] px-2 py-1 text-[10px] text-[#a8a9b1]">{project.clipCount} clips</span></div></button>)}</div> : <div className="rounded-2xl border border-dashed border-[#373840] bg-[#16171b] px-6 py-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#25272a] text-[#c8f169]"><Film size={21}/></div><h3 className="mt-4 text-sm font-medium">No projects yet</h3><p className="mt-1 text-xs text-[#858691]">Start a project and your recent work will show up here.</p><button onClick={startNewProject} className="mt-5 rounded-lg border border-[#42444a] px-4 py-2 text-xs text-white hover:border-[#c8f169]">Create your first project</button></div>}</section>
      <footer className="mt-12 flex items-center justify-between border-t border-[#282930] pt-5 text-[11px] text-[#747580]"><span>RankCut Studio</span><span>1080 × 1920 · Browser-based editing</span></footer>
    </div>
  </main>;

  return <main className="min-h-screen bg-[#101114] text-white">
    <header className="h-[66px] border-b border-[#292a31] flex items-center justify-between px-6">
      <button onClick={goToDashboard} className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-[#c8f169] text-black grid place-items-center"><Clapperboard size={17}/></div><span className="font-semibold tracking-tight">rankcut</span><span className="text-[#6f7079]">/</span><span className="text-sm text-[#a7a8b1]">{title || "Untitled countdown"}</span><ChevronDown size={15} className="text-[#777882]"/></button>
      <div className="flex items-center gap-3"><span className="hidden sm:flex items-center gap-1.5 text-xs text-[#8b8c96]"><Check size={14} className={saveState === "All changes saved" ? "text-[#c8f169]" : "text-[#f0bd60]"}/>{saveState}</span><button className="px-3 py-2 rounded-lg border border-[#34353d] text-sm hover:bg-[#22232a]">Share</button><button onClick={exportVideo} disabled={exporting} className="px-4 py-2 rounded-lg bg-[#c8f169] text-[#14160e] text-sm font-bold flex gap-2 items-center disabled:opacity-60"><Download size={15}/>{exporting ? "Rendering…" : "Export video"}</button></div>
    </header>
    <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(360px,1fr)_300px] min-h-[calc(100vh-66px)]">
      <aside className="border-r border-[#292a31] p-5 overflow-y-auto scrollbar max-h-[calc(100vh-66px)]">
        <div className="flex gap-1 p-1 rounded-xl bg-[#191a1f] mb-5"><button onClick={() => setPanel("clips")} className={`flex-1 py-2 rounded-lg text-sm ${panel === "clips" ? "bg-[#2a2b32] text-white" : "text-[#8b8c96]"}`}><Film size={14} className="inline mr-2"/>Ranking list</button><button onClick={() => setPanel("style")} className={`flex-1 py-2 rounded-lg text-sm ${panel === "style" ? "bg-[#2a2b32] text-white" : "text-[#8b8c96]"}`}><Settings2 size={14} className="inline mr-2"/>Style</button></div>
        {panel === "clips" ? <><div className="flex items-center justify-between mb-3"><div><h1 className="font-semibold text-[15px]">Your ranking</h1><p className="text-xs text-[#858691] mt-1">Drag clips to change their order</p></div><button onClick={() => setClips((old) => { const ordered = [...old].sort((a, b) => (Number.isFinite(a.rank) ? a.rank : old.length - old.indexOf(a)) - (Number.isFinite(b.rank) ? b.rank : old.length - old.indexOf(b))); const shuffled = ordered.map((c) => Number.isFinite(c.rank) ? c.rank : old.length - old.indexOf(c)).sort(() => Math.random() - .5); return old.map((c, i) => ({ ...c, rank: shuffled[i] })); })} className="text-xs rounded-md bg-[#25262d] px-2 py-1.5 text-[#c8f169]">Shuffle ranks</button></div>
          <div className="space-y-2">{clips.map((clip, i) => <div key={clip.id} draggable onDragStart={() => setDragging(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragging !== null) reorder(dragging, i); setDragging(null); }} className={`rounded-xl border ${dragging === i ? "border-[#c8f169] opacity-60" : "border-[#2b2c33]"} bg-[#18191e] p-3`}>
            <div className="flex gap-2.5 items-center"><GripVertical size={16} className="text-[#686973] cursor-grab"/><div className="w-9 h-9 rounded-lg bg-[#282930] grid place-items-center text-sm font-bold text-[#c8f169]">#{clip.rank}</div><div className="flex-1 min-w-0"><div className="text-sm truncate font-medium">{clip.name || "Add a video clip"}</div><div className="text-[11px] text-[#83848d] mt-1">{clip.file ? `${fmt(clip.end - clip.start)} selected` : "No media selected"}</div></div><button aria-label="Upload clip" onClick={() => { setUploadTarget(clip.id); setUploadDialog(true); }} className="p-2 text-[#a6a7b0] hover:text-white"><Upload size={15}/></button><button aria-label="Remove slot" disabled={clips.length <= 2} onClick={() => { if (clip.url) URL.revokeObjectURL(clip.url); setClips((old) => old.filter((c) => c.id !== clip.id)); }} className="p-2 text-[#777882] hover:text-red-300 disabled:opacity-25"><Trash2 size={14}/></button><input ref={(el) => { fileRefs.current[clip.id] = el; }} onChange={(e) => addFiles(e.target.files, clip.id)} type="file" accept="video/*" className="hidden"/></div>
            <input value={clip.label} onChange={(e) => updateClip(clip.id, { label: e.target.value })} placeholder="Caption revealed on screen" className="mt-3 w-full bg-[#111216] border border-[#2b2c33] rounded-lg px-2.5 py-2 text-xs outline-none focus:border-[#c8f169]"/>
            {clip.file && <div className="mt-3"><div className="flex items-center justify-between text-[10px] text-[#858691] mb-1"><span>TRIM RANGE</span><span>{fmt(clip.start)} — {fmt(clip.end)}</span></div><input aria-label={`Trim start for clip ${i + 1}`} type="range" min={0} max={Math.max(.1, clip.duration - .2)} step=".1" value={clip.start} onChange={(e) => { const start = Number(e.target.value); updateClip(clip.id, { start, end: Math.max(start + .2, clip.end) }); }} className="range w-full h-1"/><input aria-label={`Trim end for clip ${i + 1}`} type="range" min={Math.min(clip.duration, clip.start + .2)} max={clip.duration} step=".1" value={clip.end} onChange={(e) => updateClip(clip.id, { end: Number(e.target.value) })} className="range w-full h-1 mt-2"/></div>}
          </div>)}</div>
          <div className="grid grid-cols-2 gap-2 mt-3"><button onClick={() => { setUploadTarget(null); setUploadDialog(true); }} className="cursor-pointer border border-dashed border-[#41424a] rounded-xl px-3 py-3 text-center text-xs text-[#b6b7bf] hover:border-[#c8f169]"><Upload size={15} className="inline mr-2"/>Upload clips</button><button onClick={() => clips.length < 10 && setClips((old) => [...old.map((clip) => ({ ...clip, rank: clip.rank + 1 })), { id: crypto.randomUUID(), rank: 1, name: "", file: null, url: "", duration: 8, start: 0, end: 8, label: "Add a caption" }])} disabled={clips.length >= 10} className="border border-dashed border-[#41424a] rounded-xl px-3 py-3 text-xs text-[#b6b7bf] hover:border-[#c8f169] disabled:opacity-40"><Plus size={15} className="inline mr-2"/>{clips.length < 10 ? "Add video slot" : "10 slot limit"}</button></div>
          <div className="mt-5 border border-[#2b2c33] rounded-xl p-3 bg-[#18191e]"><div className="flex gap-2 items-center text-sm font-medium"><Link2 size={15} className="text-[#c8f169]"/>Import from URL</div><input placeholder="Paste a video URL" className="mt-3 w-full bg-[#111216] border border-[#2b2c33] rounded-lg px-3 py-2 text-xs outline-none"/><button title="URL imports require a server-side provider adapter" className="w-full mt-2 rounded-lg bg-[#25262d] text-xs text-[#999aa3] py-2">Connect source (backend hook)</button><p className="text-[10px] leading-4 text-[#73747e] mt-2">URL importing needs a provider adapter and rights-aware server fetch. See README for the integration hook.</p></div>
        </> : <><h2 className="font-semibold text-[15px]">Hook title</h2><p className="text-xs text-[#858691] mt-1">Type the complete hook title here.</p><div className="mt-4 rounded-xl border border-[#2b2c33] bg-[#18191e] p-3"><label htmlFor="hook-title" className="text-[10px] text-[#777882] uppercase tracking-wider">Title text</label><textarea id="hook-title" value={title} onChange={(e) => setTitle(e.target.value)} rows={3} maxLength={100} placeholder="For example: Top 5 Craziest Moments" className="w-full mt-2 resize-y bg-[#111216] border border-[#2b2c33] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c8f169]"/><div className="text-right text-[10px] text-[#777882] mt-1">{title.length}/100</div><div className="mt-4 border-t border-[#2b2c33] pt-3"><div className="text-[10px] text-[#777882] uppercase tracking-wider mb-2">Word colors</div><div className="max-h-52 overflow-y-auto scrollbar space-y-1.5">{titleWords.map((word, index) => <label key={`${index}-${word}`} className="flex items-center justify-between rounded-lg bg-[#111216] px-2.5 py-2"><span className="text-xs text-white truncate pr-3">{word}</span><input type="color" aria-label={`Color for ${word}`} value={titleColors[index] || "#ffffff"} onChange={(e) => setTitleColors((colors) => titleWords.map((_, i) => i === index ? e.target.value : colors[i] || "#ffffff"))} className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent"/></label>)}</div></div></div><div className="mt-5 rounded-xl bg-[#18191e] border border-[#2b2c33] p-3"><div className="text-sm font-medium">Overlay list</div><p className="text-xs text-[#83848d] mt-1">Ranks count down from #{clips.length} to #1. The active rank highlights as each clip plays.</p><div className="mt-3 flex items-center gap-2 text-xs text-[#a9aab2]"><input type="checkbox" defaultChecked className="accent-[#c8f169]"/> Show rank captions</div></div></>}
        <div className="mt-6 text-[11px] text-[#777882] flex items-center gap-2"><HelpCircle size={14}/>Local videos stay in your browser during export.</div>
      </aside>

      <section className="min-w-0 flex flex-col items-center p-5 xl:p-8 bg-[#131418]">
        <div className="w-full max-w-[780px] flex justify-between items-center mb-4"><div><div className="text-sm font-medium">Preview</div><div className="text-xs text-[#82838d] mt-1">Portrait · 9:16 · 1080 × 1920</div></div><div className="flex gap-2"><button className="p-2 rounded-lg bg-[#202127] text-[#a2a3ac]"><Layers size={15}/></button><button className="p-2 rounded-lg bg-[#202127] text-[#a2a3ac]"><MoreHorizontal size={15}/></button></div></div>
        <div className="relative h-[min(68vh,680px)] aspect-[9/16] max-w-full rounded-[20px] overflow-hidden bg-[#22232a] shadow-2xl ring-1 ring-white/10">
          {active?.url ? <video ref={videoRef} src={active.url} playsInline className="absolute inset-0 w-full h-full object-cover" onLoadedMetadata={(e) => { const v = e.currentTarget; const offset = clips.slice(0, activeIndex).reduce((sum, c) => sum + c.end - c.start, 0); v.currentTime = Math.min(active.end, active.start + Math.max(0, playhead - offset)); }} /> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#353741,#191a1f)]"><div className="text-center"><div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 grid place-items-center"><ImagePlus size={27} className="text-[#c8f169]"/></div><div className="mt-4 font-semibold">Your video preview</div><p className="text-xs text-white/50 mt-2">Upload clips to see them here</p></div></div>}
          <div className="absolute inset-x-0 top-0 h-[18%] bg-[#242424]"/>
          <div className="absolute inset-x-2 top-0 h-[18%] flex items-center justify-center px-[5%] text-center font-black text-[clamp(11px,1.82vw,22.1px)] leading-[1.08] tracking-tight" style={{ WebkitTextStroke: "1px #111", paintOrder: "stroke", textShadow: "0 2px 2px #000", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{coloredTitle.map((token, i) => <span key={`${i}-${token.text}`}><span style={{ color: token.color }}>{token.text}</span>{i < coloredTitle.length - 1 ? "\u00a0" : ""}</span>)}</div>
          <div className="absolute left-[4%] top-[18%] flex flex-col gap-[1.7%]">{ranks.map((item) => { const sequenceIndex = clips.findIndex((clip) => clip.id === item.id); const appeared = sequenceIndex <= activeIndex; const isActive = item.id === active?.id; const displayRank = Number.isFinite(item.rank) ? item.rank : clips.length - sequenceIndex; return <div key={item.id} className="relative h-[clamp(38px,7.7vh,62px)] flex items-center"><span className="font-black leading-none text-[clamp(20.8px,4.03vw,35.1px)]" style={{ color: isActive ? "#ffcb05" : "#f7f7f7", WebkitTextStroke: "2.5px #050505", paintOrder: "stroke", textShadow: "2px 3px 1px #000" }}>{displayRank}.</span>{appeared && <span className="ml-4 font-bold text-[clamp(8.45px,1.365vw,14.95px)] text-white animate-caption" style={{ WebkitTextStroke: "1px #111", paintOrder: "stroke", textShadow: "1px 2px 2px #000" }}>{item.label}</span>}</div>; })}</div>
          <div className="absolute left-3 bottom-4 rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-white/75 backdrop-blur">{active?.file ? `CLIP ${activeIndex + 1} · #${active.rank}` : "9:16 PREVIEW"}</div>
        </div>
        <div className="w-full max-w-[780px] mt-4"><div className="flex items-center gap-3"><button onClick={() => { const next = !playing; setPlaying(next); if (next) void videoRef.current?.play().catch((error) => setStatus(`Preview playback failed: ${error.message}`)); else videoRef.current?.pause(); }} className="w-9 h-9 rounded-full bg-[#c8f169] text-black grid place-items-center">{playing ? <Pause size={15}/> : <Play size={15} fill="currentColor"/>}</button><div className="flex-1"><input type="range" min="0" max={total || 1} step=".1" value={Math.min(playhead, total || 1)} onChange={(e) => { const value = Number(e.target.value); setPlayhead(value); const offset = clips.slice(0, activeIndex).reduce((sum, c) => sum + c.end - c.start, 0); if (videoRef.current) videoRef.current.currentTime = active.start + Math.max(0, value - offset); }} className="range w-full"/></div><span className="text-xs tabular-nums text-[#aaaab3]">{fmt(playhead)} / {fmt(total)}</span><Volume2 size={15} className="text-[#92939d]"/></div>
          <div className="flex gap-1.5 mt-4">{clips.map((c, i) => <button key={c.id} onClick={() => {setSelected(i); setPlayhead(clips.slice(0, i).reduce((s, x) => s + x.end - x.start, 0));}} className={`relative h-12 min-w-0 flex-1 overflow-hidden rounded-lg border ${i === activeIndex ? "border-[#c8f169]" : "border-[#373840]"} bg-[#22232a]`}>{c.url ? <video src={c.url} muted className="w-full h-full object-cover opacity-65"/> : <span className="absolute inset-0 grid place-items-center text-[#747580]"><Film size={16}/></span>}<span className="absolute left-1.5 top-1 text-[10px] font-bold drop-shadow">#{c.rank}</span></button>)}</div>
        </div>
      </section>

      <aside className="border-l border-[#292a31] p-5"><div className="flex justify-between items-center"><h2 className="font-semibold text-sm">Export settings</h2><MoreHorizontal size={17} className="text-[#7f808a]"/></div><div className="mt-5 p-3.5 rounded-xl border border-[#2b2c33] bg-[#18191e] space-y-4"><div className="flex justify-between text-xs"><span className="text-[#8c8d96]">Format</span><span className="font-medium">MP4 · H.264</span></div><div className="flex justify-between text-xs"><span className="text-[#8c8d96]">Resolution</span><span className="font-medium">1080 × 1920</span></div><div className="flex justify-between text-xs"><span className="text-[#8c8d96]">Frame rate</span><span className="font-medium">Source</span></div><div className="flex justify-between text-xs"><span className="text-[#8c8d96]">Duration</span><span className="font-medium">{fmt(total)}</span></div></div><div className="mt-5"><div className="flex items-center gap-2 text-sm font-medium"><Scissors size={15} className="text-[#c8f169]"/>Quick tips</div><ul className="mt-3 space-y-3 text-xs leading-5 text-[#8e8f98]"><li className="flex gap-2"><span className="text-[#c8f169]">•</span>Drag ranking cards to set the countdown order.</li><li className="flex gap-2"><span className="text-[#c8f169]">•</span>Trim each clip using the two timeline handles.</li><li className="flex gap-2"><span className="text-[#c8f169]">•</span>Export runs locally; long videos need browser memory.</li></ul></div><div className="mt-7"><button onClick={exportVideo} disabled={exporting} className="w-full rounded-xl bg-[#c8f169] text-[#15170f] font-bold py-3 text-sm flex gap-2 justify-center items-center disabled:opacity-60"><Sparkles size={16}/>{exporting ? "Rendering your video" : "Export video"}</button>{exporting && <div className="mt-3"><div className="flex justify-between text-[10px] text-[#9899a2] mb-1"><span>{status}</span><span>{Math.round(progress)}%</span></div><div className="h-1.5 rounded-full bg-[#303139] overflow-hidden"><div className="h-full bg-[#c8f169] transition-all" style={{width:`${progress}%`}}/></div></div>}{!exporting && status && <p className="mt-3 text-xs text-[#d6b879]">{status}</p>}<p className="text-[10px] text-[#71727b] text-center mt-3">First export downloads the video engine.</p></div></aside>
    </div>
    {uploadDialog && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="w-full max-w-md rounded-2xl border border-[#383941] bg-[#191a1f] p-5 shadow-2xl">
        <div className="flex items-start justify-between"><div><h2 id="upload-title" className="font-semibold">Add video{uploadTarget ? " to slot" : "s"}</h2><p className="text-xs text-[#999aa3] mt-1">Choose a video from your device or download one first.</p></div><button onClick={() => setUploadDialog(false)} className="p-1.5 text-[#aaaab2] hover:text-white" aria-label="Close"><X size={17}/></button></div>
        <button onClick={() => modalFileRef.current?.click()} className="mt-5 w-full rounded-xl bg-[#c8f169] py-3 text-sm font-bold text-black"><Upload size={15} className="inline mr-2"/>Choose local video</button>
        <button onClick={() => { const popup = window.open("https://extract.express/", "extractExpress", "popup=yes,width=1100,height=800,resizable=yes,scrollbars=yes"); if (!popup) setStatus("Allow popups for this site to open Extract Express."); }} className="mt-2 w-full rounded-xl border border-[#3a3b43] py-3 text-sm text-white hover:bg-[#25262d]"><Link2 size={15} className="inline mr-2"/>Open Extract Express</button>
        <p className="mt-3 text-[11px] leading-5 text-[#8b8c96]">After downloading, return here and choose the downloaded video. Browsers don’t let this editor read another website’s downloads automatically.</p>
        <input ref={modalFileRef} type="file" multiple={!uploadTarget} accept="video/*" className="hidden" onChange={(e) => { addFiles(e.target.files, uploadTarget || undefined); setUploadDialog(false); e.currentTarget.value = ""; }}/>
      </div>
    </div>}
  </main>;
}


