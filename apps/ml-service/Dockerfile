# FORGE MIND — ML Service
# Multi-stage build with model pre-download
# Usage: docker build -f apps/ml-service/Dockerfile -t forge-mind-ml .

# ─── Stage 1: dependency install ─────────────────────────────────────────────
FROM python:3.11-slim AS deps

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY apps/ml-service/pyproject.toml ./
RUN pip install --no-cache-dir -e "." 2>/dev/null || pip install --no-cache-dir fastapi uvicorn sentence-transformers openai-whisper httpx redis pydantic-settings

# ─── Stage 2: model download (cached separately) ──────────────────────────────
FROM deps AS model-cache

# Pre-download models so the container starts instantly
ENV TRANSFORMERS_CACHE=/app/model-cache
ENV HF_HOME=/app/model-cache

RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
RUN python -c "import whisper; whisper.load_model('base')"

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Non-root user
RUN useradd -r -s /bin/false -u 1001 forge
USER forge

# Copy installed packages and models
COPY --from=model-cache /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=model-cache /usr/local/bin /usr/local/bin
COPY --from=model-cache /app/model-cache /app/model-cache

ENV TRANSFORMERS_CACHE=/app/model-cache
ENV HF_HOME=/app/model-cache

COPY apps/ml-service/src ./src

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"]

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
