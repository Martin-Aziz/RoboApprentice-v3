# FORGE MIND — Rust API
# Multi-stage build using cargo-chef for layer caching
# Usage: docker build -f apps/api/Dockerfile -t forge-mind-api .

# ─── Stage 1: chef (cargo-chef planner) ──────────────────────────────────────
FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef
WORKDIR /app

# ─── Stage 2: planner ─────────────────────────────────────────────────────────
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ─── Stage 3: builder ─────────────────────────────────────────────────────────
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json

# Build dependencies — this layer is cached unless Cargo.toml/Cargo.lock change
RUN cargo chef cook --release --recipe-path recipe.json

# Build application
COPY . .
RUN cargo build --release --bin api

# ─── Stage 4: runtime ─────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Non-root user
RUN useradd -r -s /bin/false -u 1001 forge
USER forge

COPY --from=builder /app/target/release/api /app/api

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["wget", "-qO-", "http://localhost:8080/health"]

ENTRYPOINT ["/app/api"]
