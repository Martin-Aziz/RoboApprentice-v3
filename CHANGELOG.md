# Changelog

All notable changes to FORGE MIND are documented here.

This project follows [Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Production Dockerfiles (multi-stage, cargo-chef) for all three services
- `docker-compose.prod.yml` with Traefik TLS termination
- `scripts/deploy.sh` one-click VPS deploy script

---

## [0.1.0] — 2025-01-01

### Added

#### Security
- RS256 JWT with refresh token rotation (HttpOnly cookie)
- Argon2 password hashing with configurable cost
- CORS restricted to `ALLOWED_ORIGINS` env var (no more wildcard in production)
- `Secure` flag on refresh-token cookie gated on `APP_ENV=production`
- Redis-backed sliding-window rate limiting on `/auth/register` and `/auth/login`
- File type validation on video uploads (MIME allowlist)
- Upload size cap via `MAX_UPLOAD_BYTES` env var
- `X-Internal-Secret` header required on ML→API callback routes

#### API Routes
- `POST /api/v1/auth/register` — user registration
- `POST /api/v1/auth/login` — login + access + refresh tokens
- `POST /api/v1/auth/logout` — clears refresh cookie
- `POST /api/v1/auth/refresh` — access token rotation
- `GET /api/v1/auth/me` — current user
- `POST /api/v1/facilities` — create facility
- `GET /api/v1/facilities` — list own facilities
- `GET /api/v1/facilities/:id` — get facility
- `POST /api/v1/facilities/:id/robots` — register robot
- `GET /api/v1/facilities/:id/robots` — list robots
- `POST /api/v1/robots/:id/estop` — emergency stop
- `POST /api/v1/facilities/:id/skills` — create skill
- `GET /api/v1/facilities/:id/skills` — list + search skills (full-text)
- `GET /api/v1/facilities/:id/skills/similar` — pgvector semantic similarity search
- `GET /api/v1/skills/:id` — get skill
- `PATCH /api/v1/skills/:id` — update skill metadata
- `DELETE /api/v1/skills/:id` — soft delete skill
- `POST /api/v1/skills/:id/demonstrations` — upload video demonstration
- `GET /api/v1/skills/:id/demonstrations` — list demonstrations
- `PATCH /internal/demonstrations/:id` — ML callback: transcript + quality score
- `PATCH /internal/skills/:id/embedding` — ML callback: store 384-dim embedding + set status='ready'
- `GET /health` — liveness check

#### ML Service
- `/api/v1/embed` — text embedding (all-MiniLM-L6-v2, 384 dims)
- `/api/v1/transcribe` — video transcription (Whisper)
- `/api/v1/process-demonstration` — combined transcription + embedding + quality scoring
- Redis BRPOP worker with internal secret callback authentication

#### Infrastructure
- PostgreSQL 16 + pgvector for semantic search
- Redis 7 job queue
- S3-compatible storage (MinIO for dev, Cloudflare R2 for prod)
- GitHub Actions CI (Rust + Python + Frontend)
- Security audit workflow (weekly)
- E2E workflow (Playwright, runs on merge to main)

#### Testing
- 38 Rust integration tests (auth, facilities, robots, skills, internal callbacks)
- 7 ML API edge-case tests
- 7 ML worker unit tests
- 4 demonstration endpoint tests
- 3 E2E Playwright test suites (auth, teaching flow, robot management)
- 2 k6 load test scripts (auth + skills endpoints)

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

---

[Unreleased]: https://github.com/YOUR_ORG/forge-mind/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YOUR_ORG/forge-mind/releases/tag/v0.1.0
