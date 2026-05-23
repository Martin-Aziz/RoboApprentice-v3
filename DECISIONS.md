# Architecture Decisions

This document records key technical decisions made during FORGE MIND MVP development, along with their rationale.

## ADR-001: Rust/Axum for Core API

**Context:** Need a high-performance API that can handle real-time robot control communication with low latency.

**Decision:** Use Rust with Axum 0.7 framework.

**Rationale:**
- Sub-millisecond latency for robot control paths
- Memory safety without GC pauses — critical for real-time operations
- Excellent async ecosystem (tokio) for concurrent WebSocket connections
- Type system catches entire classes of bugs at compile time

**Trade-offs:** Higher initial development velocity cost vs. Python/Node, offset by fewer runtime bugs.

## ADR-002: Python/FastAPI for ML Service

**Context:** ML inference (skill learning, embedding, transcription) requires Python ecosystem.

**Decision:** Separate Python microservice behind internal API boundary.

**Rationale:**
- PyTorch, sentence-transformers, Whisper all native Python
- Isolated scaling — ML workloads can scale independently
- Rust API delegates ML tasks via Redis job queue + HTTP
- Clean separation of concerns

## ADR-003: JWT RS256 with Refresh Token Rotation

**Context:** Need stateless auth for API with secure session management.

**Decision:** RS256 JWT access tokens (15-min TTL) + opaque refresh tokens (7-day, single-use rotation).

**Rationale:**
- RS256 allows public key verification without sharing signing key
- Short-lived access tokens limit blast radius of token theft
- Refresh rotation detects token reuse (potential theft)
- httpOnly cookies for refresh tokens prevent XSS extraction
- SHA-256 hashing of stored refresh tokens protects against DB breach

## ADR-004: PostgreSQL + pgvector for Similarity Search

**Context:** Skills need semantic search ("find skills similar to this description").

**Decision:** Use pgvector extension with 384-dimension embeddings (all-MiniLM-L6-v2).

**Rationale:**
- No separate vector DB infrastructure to manage
- 384 dimensions balances quality vs. storage/speed
- IVFFlat index with 100 lists sufficient for MVP scale
- PostgreSQL already required for relational data

## ADR-005: MinIO (dev) / Cloudflare R2 (prod) for Object Storage

**Context:** Demonstration videos need S3-compatible storage.

**Decision:** MinIO for local development, Cloudflare R2 for production.

**Rationale:**
- S3 API compatibility means same code path
- MinIO runs locally in Docker — no cloud dependency for dev
- R2 has zero egress fees — important for video-heavy workloads
- Cheaper than AWS S3 for our read-heavy pattern

## ADR-006: Redis for Rate Limiting, Cache, and Job Queue

**Context:** Need rate limiting, caching, and async job dispatch.

**Decision:** Single Redis instance serving all three roles.

**Rationale:**
- Sufficient for MVP scale (< 100 concurrent users)
- Token bucket rate limiting in middleware
- Demo processing jobs queued as Redis lists (`LPUSH`/`BRPOP`)
- Session/cache data with TTL-based expiry
- Split into separate instances when scale demands it

## ADR-007: Next.js 15 App Router for Frontend

**Context:** Need a responsive web UI for teaching interface and skill management.

**Decision:** Next.js 15 with App Router, React 19, Shadcn/ui, TailwindCSS 4.

**Rationale:**
- Server components reduce client bundle size
- App Router provides nested layouts matching our app structure
- Shadcn/ui gives accessible, customizable components (not a dependency)
- TailwindCSS 4 for consistent design tokens

## ADR-008: Monorepo with Cargo + pnpm Workspaces

**Context:** Multiple services (API, ML, frontend) in one repository.

**Decision:** Hybrid monorepo — Cargo workspace for Rust, pnpm workspaces for JS/TS.

**Rationale:**
- Single repo simplifies CI/CD, code review, and atomic changes
- Cargo workspace shares dependencies across Rust crates
- pnpm workspaces for frontend packages
- Docker Compose ties everything together for local dev

## ADR-009: Simulator-Only for MVP

**Context:** No physical robot hardware available during initial development.

**Decision:** Build all robot interaction through a simulator abstraction layer.

**Rationale:**
- Enables full development without hardware dependency
- Abstraction layer means real drivers plug in later without API changes
- Simulated latency/failures for realistic testing
- Focus MVP on teaching workflow, not hardware integration
