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

## Pre-Purchase Feasibility Simulator

The virtual feasibility API estimates reach, payload fit, cycle time, and throughput from an uploaded task video without connecting to robot hardware. See [docs/FEASIBILITY_SIMULATOR.md](docs/FEASIBILITY_SIMULATOR.md) for API usage, kinematic assumptions, safety limitations, and robot-spec maintenance.

## Risk Assessment Accelerator

Deployed tasks can generate an editable collaborative-robot risk assessment draft with plain-language review prompts and mandatory qualified-person sign-off. It is never represented as complete or certified. See [docs/RISK_ASSESSMENT_ACCELERATOR.md](docs/RISK_ASSESSMENT_ACCELERATOR.md) for thresholds, disclaimer rationale, API details, and DOCX maintenance.

## Gripper and Peripheral Recommender

Task detail pages can rank sourced end-effectors using robot compatibility, a 30% payload margin, part properties, grip force, and cycle fit. Recommendations are technically ranked and always include the affiliate disclosure. See [docs/GRIPPER_RECOMMENDER.md](docs/GRIPPER_RECOMMENDER.md) for catalogue maintenance, estimated-field handling, scoring, and affiliate-tag updates.

## Automation Passport

Deployed robot processes can be exported as privacy-stripped, robot-agnostic passports and re-planned for supported robots and target workcells. Imports preserve immutable lineage and block deployment when any translated waypoint is unreachable. See [docs/AUTOMATION_PASSPORT.md](docs/AUTOMATION_PASSPORT.md).

## Fixture and Jig Designer

Task detail pages can generate tolerance-controlled fixture specifications and manifold STL files for simple nests and V-blocks. Irregular and uncertain geometry receives a written brief only and mandatory qualified review. See [docs/FIXTURE_DESIGNER.md](docs/FIXTURE_DESIGNER.md).

## Outcome-Based Pricing

Customers may choose a non-retroactive outcome plan based on verified qualifying deployments, with a confirmed integration-cost baseline and clearly disclosed monthly floor and cap. See [docs/OUTCOME_BASED_PRICING.md](docs/OUTCOME_BASED_PRICING.md).

## License

See `LICENSE`.
