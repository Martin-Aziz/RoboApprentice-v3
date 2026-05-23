"""FORGE MIND ML Service — FastAPI application."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from .config import settings
from .inference import inference_service
from .models import (
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    ProcessDemonstrationRequest,
    ProcessDemonstrationResponse,
    TranscribeRequest,
    TranscribeResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize models on startup."""
    await inference_service.initialize()
    yield


app = FastAPI(
    title="FORGE MIND ML Service",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        version="0.1.0",
        mock_mode=settings.mock_inference,
    )


@app.post("/api/v1/embed", response_model=EmbedResponse)
async def embed_text(req: EmbedRequest) -> EmbedResponse:
    """Generate embedding for input text."""
    embedding = await inference_service.embed_text(req.text)
    return EmbedResponse(
        embedding=embedding,
        model=settings.embedding_model,
        dimensions=settings.embedding_dim,
    )


@app.post("/api/v1/transcribe", response_model=TranscribeResponse)
async def transcribe(req: TranscribeRequest) -> TranscribeResponse:
    """Transcribe audio from a video file."""
    transcript, confidence, language = await inference_service.transcribe_video(req.video_url)
    return TranscribeResponse(
        transcript=transcript,
        confidence=confidence,
        language=language,
    )


@app.post("/api/v1/process-demonstration", response_model=ProcessDemonstrationResponse)
async def process_demonstration(
    req: ProcessDemonstrationRequest,
) -> ProcessDemonstrationResponse:
    """Process a demonstration: transcribe, embed, and score quality."""
    transcript, _confidence, _language = await inference_service.transcribe_video(req.video_url)

    embedding = await inference_service.embed_text(transcript)

    quality_score = await inference_service.score_quality(req.video_url, transcript)

    return ProcessDemonstrationResponse(
        demonstration_id=req.demonstration_id,
        transcript=transcript,
        embedding=embedding,
        quality_score=quality_score,
        status="completed",
    )
