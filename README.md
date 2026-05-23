# Aurevix

Teach industrial robots new tasks from a single human demonstration.
Browser-based, no login required.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

Optional: install Ollama for local LLM interpretation.

```bash
brew install ollama
ollama pull llama3.1:8b
```

## Supported Robots

- Universal Robots UR3, UR5, UR5e, UR10, UR10e
- KUKA KR 6, KR 10
- Techman TM5, TM12

## Languages

English (US/UK), Deutsch, Español, 中文 (简体), 日本語

## Architecture

- Frontend: Next.js 15, React 19, Three.js, urdf-loader
- Local LLM: Ollama optional, with deterministic fallback interpretation
- Persistence: IndexedDB via `idb`
- Backend services for future cloud integration: Rust API and Python ML service

## License

See `LICENSE`.
