# MemeBlockbuster 🎬

Turn any meme or idea into a full cinematic movie trailer, powered end-to-end by Higgsfield.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY (+ Supabase if wiring real DB/storage)
npm run dev
```

## What's real vs stubbed for the 48h MVP

- **Real**: full pipeline logic (`lib/pipeline.ts`), Higgsfield MCP call wrapper (`lib/higgsfield.ts`),
  API routes, all UI screens.
- **Stubbed for speed**: `lib/db.ts` uses in-memory maps instead of Supabase — swap in the
  commented client, schema is ready in `schema.sql`. `FaceUploader` uses local object URLs
  instead of real storage upload — swap in Supabase Storage / S3 presigned upload.
- **Production note**: a full run is 25–40+ sequential MCP calls, which will exceed a
  serverless function's request timeout. Move `runFullPipeline` into a background job
  (Inngest, QStash, or a simple worker process) before shipping past the demo.

## Pipeline (see ARCHITECTURE section in project notes)

1. Soul ID creation per uploaded face
2. Claude plans 8 trailer beats (structure + voiceover lines) for the chosen Vibe/Director
3. Per scene: `generate_image` → `generate_video` → (`upscale_video` for hero beats) → `reframe`
4. `generate_audio` for voiceover lines + music bed
5. `explainer_video` (Canvas) composites everything into the final vertical trailer
6. Studio screen lets users remix any single scene (re-runs steps 3 for that scene only)
7. "Generate Sequel" reuses Soul IDs, re-plans 8 new beats, re-runs the whole loop

## Next up after MVP

- Swap in-memory DB for Supabase (schema already in `schema.sql`)
- Background job queue for pipeline runs
- Real subtitle burn-in via SRT + Canvas
- Share card generator (OG image) for #MemeBlockbuster posts
