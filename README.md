# RankCut — vertical countdown editor MVP

RankCut is a browser-based studio for creating vertical countdown videos for TikTok, YouTube Shorts, and Instagram Reels. Start a project, add and trim video clips, arrange their playback order, assign or shuffle rank numbers, and write captions that reveal as the video progresses. Customize the hook title with per-word colors and preview the composition in a 9:16 canvas before exporting.

The editor exports portrait MP4 video at 1080×1920 using FFmpeg.wasm. Uploaded footage is processed in the browser. Project settings and uploaded files are saved locally in IndexedDB, so projects can be reopened in the same browser and device; they are not synced between devices or accounts.

## Architecture

- **Next.js App Router + React client editor**: upload local clips, reorder ranking, edit captions and trims, style each hook word, and preview a 9:16 composition.
- **Browser rendering**: FFmpeg.wasm handles trim, center crop/scale to 1080×1920, audio preservation, H.264/AAC encode, and concatenation. Each segment gets a transparent PNG overlay generated from SVG on a browser canvas, so FFmpeg does not depend on installed fonts.
- **Private by default**: uploaded clip bytes are processed in the browser. The first export loads the single-thread FFmpeg core from unpkg; self-host it under `public/ffmpeg/` for production/offline use and configure the worker/CSP accordingly.
- **URL import extension point**: add an authenticated server route/provider that validates allowed hosts, retrieves permitted media, checks size/type, and returns an uploadable object. Browser-side arbitrary URL fetch is deliberately not used because of CORS and SSRF concerns.

## Structure

```text
src/app/page.tsx             interactive editor and preview
src/app/layout.tsx           app shell and metadata
src/app/globals.css          Tailwind v4 and base styles
src/lib/render-video.ts      FFmpeg.wasm compositor/exporter
```

## Install and run

```bash
npm install
npm run dev
```

Dependencies: Next.js, React, Tailwind CSS 4, TypeScript, `@ffmpeg/ffmpeg`, `@ffmpeg/util`, and `lucide-react`.

## MVP limits

- Videos are cropped to fill; there is no per-clip pan/zoom yet.
- Output is constant 30 fps for reliable concatenation. Source audio is retained when present.
- The browser encoder is compute- and memory-intensive. For production, queue longer jobs on a server-side FFmpeg worker and persist project metadata/assets in object storage.
- Mov support depends on the source codec supported by the bundled FFmpeg build.
