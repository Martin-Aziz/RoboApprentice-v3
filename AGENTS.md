# AGENTS.md — Aurevix Project Orientation

> Read this first. It is the minimum context to work in this repo without wasting tokens re-discovering structure.

---

## What this project is

**Aurevix** is an AI-powered robot teaching platform. Operators record a video demonstration of a manual task; the system extracts discrete motion steps, generates executable robot code (URScript / ROS 2 Python / pseudocode), and packages everything into a reusable, versioned *skill*.

Primary user: SME factory operator, not a robotics engineer.

---

## Monorepo structure

```
RoboApprentice/
├── apps/
│   ├── web/                   ← Next.js 15 frontend (PRIMARY WORKING APP)
│   │   ├── src/
│   │   │   ├── app/           ← Next.js App Router pages
│   │   │   │   ├── layout.tsx         Root layout (fonts, metadata)
│   │   │   │   ├── page.tsx           Landing page
│   │   │   │   ├── globals.css        Design system (light theme, CSS vars)
│   │   │   │   └── app/               Authenticated app shell
│   │   │   │       ├── layout.tsx     Sidebar + mobile header
│   │   │   │       ├── page.tsx       Dashboard (module 001)
│   │   │   │       ├── teach/         CORE: teaching workflow (module 004)
│   │   │   │       ├── robots/        Fleet management (module 002)
│   │   │   │       ├── skills/        Skills library (module 003)
│   │   │   │       ├── library/       Ready skills browse (module 005)
│   │   │   │       └── settings/      Operator profile (module 099)
│   │   │   │   └── api/               Next.js Route Handlers (all server-side)
│   │   │   │       └── tasks/[id]/
│   │   │   │           ├── interpret/ ← SSE streaming AI extraction (MAIN AI ROUTE)
│   │   │   │           ├── codegen/   Code generation (URScript/ROS2/pseudo)
│   │   │   │           ├── simulation/ Download simulation files
│   │   │   │           └── feedback/  Record run feedback
│   │   │   ├── components/
│   │   │   │   ├── robot-arm.tsx      Three.js 3D arm with IK + replay controls
│   │   │   │   ├── camera-feed.tsx    Live camera preview (placeholder)
│   │   │   │   ├── hud.tsx            Design system components (HudFrame, Pulse, etc.)
│   │   │   │   ├── logo.tsx           LogoMark SVG + Wordmark
│   │   │   │   ├── app-sidebar.tsx    Navigation sidebar
│   │   │   │   └── ui/                shadcn/ui components (button, input, etc.)
│   │   │   └── lib/
│   │   │       ├── types.ts           ALL TypeScript interfaces (start here)
│   │   │       ├── skill-store.ts     localStorage skill persistence (CRUD)
│   │   │       ├── task-store.ts      In-memory server task store (global Map)
│   │   │       ├── codegen.ts         URScript / ROS2 / pseudocode generators
│   │   │       ├── policy-pipeline.ts Approach insertion, IK validation, retiming
│   │   │       ├── simulation.ts      Manifest + matplotlib animator builders
│   │   │       ├── store.ts           Zustand auth store
│   │   │       └── utils.ts           cn() tailwind merge utility
│   └── ml-service/            ← Python FastAPI (not used in MVP, Ollama used instead)
├── AGENTS.md                  ← YOU ARE HERE
├── README.md                  Full project docs
└── DECISIONS.md               Architecture decision records
```

---

## Tech stack (frontend — the active MVP surface)

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, RSC) |
| Language | TypeScript strict |
| Styling | Tailwind CSS v4 + custom CSS vars in globals.css |
| Components | shadcn/ui (customised to Aurevix light theme) |
| 3D visualisation | Three.js (robot-arm.tsx) |
| State (client) | React `useState` + React Query (`@tanstack/react-query`) |
| State (auth) | Zustand (`useAuthStore`) |
| Video drop | `react-dropzone` |
| AI backend | Ollama local LLM (`OLLAMA_URL`, `OLLAMA_MODEL` env vars) |
| Persistence | `localStorage` via `lib/skill-store.ts` |

---

## Design system — critical constants

All colours are CSS custom properties in `src/app/globals.css`. **Light theme.**

| Variable | Value | Use |
|---|---|---|
| `--ink` | 248 250 252 | Page background (slate-50) |
| `--ink-2` | 255 255 255 | Card background (white) |
| `--ink-3` | 241 245 249 | Raised / input (slate-100) |
| `--bone` | 15 23 42 | Primary text (slate-900) |
| `--bone-2` | 71 85 105 | Secondary text (slate-600) |
| `--signal-cyan` | 2 132 199 | Primary brand accent (sky-600) |
| `--signal-amber` | 217 119 6 | Warning / secondary accent |
| `--signal-green` | 5 150 105 | Success |
| `--signal-red` | 220 38 38 | Error / destructive |

Use `rgb(var(--signal-cyan))` syntax everywhere. Never hardcode hex colours.

The `.hud` class renders a white card with sky-blue corner brackets (the brand's precision aesthetic). `--radius` is `6px`.

---

## Core data flow

```
Operator fills form (name, task description)
      ↓
createSkillMutation → Skill object (local, no API)
      ↓
uploadDemoMutation → Demonstration + video blob URL
      ↓
POST /api/tasks          → creates Task in server memory (task-store.ts)
POST /api/tasks/[id]/interpret → SSE stream
      │  Ollama LLM processes title + transcript
      │  StreamingJSONParser extracts steps as they stream
      │  Each step → { type:"step", step: TaskStep }
      │  Final → { type:"done", steps, policy, warnings }
      ↓
TaskPolicy built, validated by policy-pipeline.ts
      ↓
GET /api/tasks/[id]/codegen?target=urscript|ros2_python|pseudocode
GET /api/tasks/[id]/simulation?format=python|json
      ↓
submitFeedback → POST /api/tasks/[id]/feedback
      ↓
Skill + Policy saved to localStorage (lib/skill-store.ts)
```

---

## Key files to read first for any new feature

1. `lib/types.ts` — all interfaces. Read this before touching data shapes.
2. `app/app/teach/page.tsx` — the main 7-step workflow. Most feature work lands here.
3. `app/api/tasks/[id]/interpret/route.ts` — the AI pipeline. Touch with care.
4. `lib/policy-pipeline.ts` — post-processing after AI output.
5. `app/globals.css` — design tokens. Never add raw colours elsewhere.

---

## Environment variables

```
OLLAMA_URL=http://localhost:11434   # local Ollama instance
OLLAMA_MODEL=gemma4:latest          # LLM model name
```

No auth required in MVP — middleware is a passthrough.

---

## Running locally

```bash
# From repo root
pnpm install
pnpm --filter @forge-mind/web dev   # starts Next.js on :3000

# Ollama must be running separately:
ollama serve
ollama pull gemma4
```

---

## Patterns to follow

- **CSS vars for colour** — always `rgb(var(--signal-cyan))` not `#0284C7`
- **`.hud` for cards** — use the HUD class with `<span className="hud-corner-tr" />` / `hud-corner-bl` for the corner bracket aesthetic
- **`font-mono` for telemetry** — numbers, codes, status badges use JetBrains Mono
- **`font-display` for headings** — Instrument Serif for `h1`/`h2`
- **`tabular` for stats** — any numeric stat gets `className="tabular"`
- **No hardcoded colours in components** — use CSS vars or Tailwind mapped classes
- **Route handlers are server-only** — no `"use client"` in `/app/api/`
- **Task store is in-memory per process** — data resets on server restart; skills are persisted via localStorage

---

## Things that are intentionally incomplete / future work

- Auth is disabled (middleware is a passthrough)
- `CameraFeed` is a placeholder with no real camera access
- The ML service (`apps/ml-service/`) is not connected — Ollama is used directly
- Robots page has no real hardware connectivity
- Skills confidence score is always 0 on creation (computed from feedback over time)
