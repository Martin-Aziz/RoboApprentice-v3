# Aurevix V2 - Demo-First Global Edition

Aurevix turns a human demonstration video into a reusable robot skill: interpreted motion steps, replayable policy, generated robot code, and a shareable ROI artifact.

V2 is a buyer-facing demo fork. It removes the login wall, preloads realistic plant data, localizes the product for four regions, and gets a prospect from landing page to visible robot-learning result in under 30 seconds.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

The demo runs from the Next.js frontend with seeded in-memory/localStorage data. The Rust API and Python ML service remain in the repository and still build, but they are not required for the v2 demo path.

## Ollama

The teach flow still uses local-only Ollama when available. Start Ollama separately:

```bash
ollama serve
ollama pull gemma4
```

If Ollama is unavailable, `/app/teach` falls back to a pre-recorded interpretation sequence so the prospect demo does not break.

## Locales

Use the flag pills in the nav or settings page to switch between:

- `en-US`
- `en-GB`
- `de-DE`
- `zh-CN`

Currency, dates, units, ROI defaults, and regional product framing adapt to the selected locale.

## Reset Demo Data

Use the reset button in the sidebar, command palette, or settings page. It clears v2 localStorage demo state and reloads the app.

## Backend Services

The original services are still present:

- `apps/api` - Rust Axum API with auth, facilities, robots, skills, demonstrations
- `apps/ml-service` - Python FastAPI ML service

They are preserved for the migration path back to the full v1 architecture.

