# Contributing to FORGE MIND

Thank you for taking the time to contribute! Here's everything you need to know.

---

## Code of Conduct

Be respectful, constructive, and collaborative. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

## How to Contribute

### Reporting Bugs

1. **Search first** — check [Issues](https://github.com/YOUR_ORG/forge-mind/issues) for duplicates.
2. Open a new issue using the **Bug Report** template.
3. Include: OS, versions (Rust, Python, Node), reproduction steps, expected vs. actual behaviour.

### Suggesting Features

1. Open an issue using the **Feature Request** template.
2. Describe the problem you're solving, not just the solution.
3. Discuss before implementing large changes.

### Submitting a Pull Request

1. **Fork** the repo and create a branch from `develop`:
   ```bash
   git checkout -b feat/my-feature develop
   ```
2. Follow the [Development Setup](#development-setup) steps.
3. Write tests for any new behaviour.
4. Ensure all checks pass locally:
   ```bash
   cargo fmt --all
   cargo clippy --all-targets -- -D warnings
   cargo test --all
   cd apps/ml-service && ruff check src tests && pytest tests/ -v
   cd apps/web && pnpm typecheck && pnpm lint && pnpm test:unit
   ```
5. Open a PR against `develop` with a clear description.
6. Link any related issues.

---

## Development Setup

See [README.md](README.md) for full instructions.

**TL;DR:**
```bash
cp .env.example .env
docker compose up -d postgres redis minio
sqlx migrate run
cargo run --bin api  # in one terminal
cd apps/ml-service && uvicorn src.main:app --reload --port 8001  # another terminal
cd apps/web && pnpm dev  # another terminal
```

---

## Coding Standards

### Rust

- All code must pass `cargo clippy -- -D warnings`.
- Run `cargo fmt` before committing.
- New endpoints require integration tests using `sqlx::test` + `tower::ServiceExt::oneshot`.
- Avoid `unwrap()` in production paths — use `?` or proper error handling via `AppError`.

### Python

- All code must pass `ruff check` and `ruff format --check`.
- Type annotations required on all public functions.
- New functionality requires `pytest` tests.

### TypeScript / React

- All code must pass `tsc --noEmit` with zero errors.
- Run `eslint` with zero warnings before committing.
- New components require Vitest + React Testing Library unit tests.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready releases only |
| `develop` | Integration branch for features |
| `feat/*` | Feature branches (merge → develop) |
| `fix/*` | Bug fix branches |
| `chore/*` | Maintenance (deps, tooling, docs) |

---

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

**Examples:**
```
feat(skills): add pgvector similarity search endpoint
fix(auth): apply secure flag to refresh cookie in production
test(api): add integration tests for robot E-stop endpoint
```

---

## Versioning

FORGE MIND follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`). All changes are recorded in [CHANGELOG.md](CHANGELOG.md).
