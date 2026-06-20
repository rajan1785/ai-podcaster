# ContextCast

ContextCast turns a video or audio file of up to 30 minutes into a timestamped media workspace: aligned transcript, grounded summary and chapters, ranked vertical clips, and chat that jumps back to its source moment.

## What is implemented

- Server-validated MP4, MOV, WebM, MP3, M4A, WAV, and OGG uploads up to 500 MB.
- FFprobe duration validation and FFmpeg audio extraction, frame sampling, and 9:16 clip rendering.
- Whisper transcription with word and segment timestamp granularities.
- GPT-4o multimodal analysis over transcript plus representative video frames.
- Structured chapter, summary, and viral-clip generation.
- Hybrid temporal retrieval: 65% OpenAI embeddings and 35% MiniSearch BM25-style keyword relevance.
- Context-scoped chat around a selected transcript moment, with clickable timestamp citations.
- BullMQ queue backed by Redis/Valkey, exponential retries, and a separately supervised worker process.
- Atomic, disk-backed job records and byte-range media streaming.
- A fully functional demo-analysis fallback when `OPENAI_API_KEY` is absent.

## Local development

Prerequisites: Node.js 22+, FFmpeg/FFprobe, and optionally Redis.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Add `OPENAI_API_KEY` for live analysis. Without it, uploaded files are still probed, converted, clipped, played, indexed, and displayed with clearly labeled demo analysis. If `REDIS_URL` is absent, development uses a safe in-process queue fallback; production should use Redis.

Run the production worker and web server together:

```bash
npm run build
npm run start:all
```

Run all verification:

```bash
npm run check
```

## Processing architecture

```mermaid
flowchart LR
  U[Upload API] --> D[(Persistent media disk)]
  U --> Q[BullMQ / Valkey]
  Q --> W[Worker process]
  W --> F[FFmpeg and FFprobe]
  F --> O[Whisper and GPT-4o]
  O --> I[Embeddings plus BM25 index]
  W --> D
  P[Player and chat APIs] --> D
  P --> I
```

Job metadata is written atomically to `MEDIA_DATA_DIR`. Original media and rendered clips are served through authenticated-ready route handlers with HTTP byte-range support rather than directly from `public/`.

## Render deployment

The included `render.yaml` provisions:

- a Docker web service;
- a persistent 10 GB disk mounted at `/var/data`;
- a Render Key Value instance for BullMQ;
- a health check at `/api/health`.

Create a Render Blueprint from this repository, enter `OPENAI_API_KEY`, and apply it. The `starter` service is intentional because Render persistent disks are not available on the free web tier. The Docker image installs FFmpeg and starts Next.js and the worker as separate supervised processes.

For higher throughput, move the worker to a separate Render background service and replace disk storage with S3-compatible object storage so web and worker services can share media safely.

## API surface

- `POST /api/upload` — validate, persist, and enqueue media.
- `GET /api/job/:id` — progress and public result data.
- `GET /api/media/:id` — original media with Range support.
- `GET /api/clip/:id/:clipId` — generated vertical clip with Range support.
- `POST /api/chat` — scoped hybrid retrieval and grounded response.
- `GET /api/health` — deployment health check.

## Production notes

This submission keeps identity out of scope. Before a public multi-tenant launch, add authentication and job ownership checks, direct-to-object-storage uploads, rate limiting, content moderation, retention cleanup, observability, and a separate autoscaled worker service.
