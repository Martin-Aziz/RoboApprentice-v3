"""FORGE MIND ML Service — Pydantic models."""

from uuid import UUID

from pydantic import BaseModel


class EmbedRequest(BaseModel):
    """Request to generate text embedding."""

    text: str


class EmbedResponse(BaseModel):
    """Embedding vector response."""

    embedding: list[float]
    model: str
    dimensions: int


class TranscribeRequest(BaseModel):
    """Request to transcribe audio from a video."""

    video_url: str
    skill_id: UUID


class TranscribeResponse(BaseModel):
    """Transcription result."""

    transcript: str
    confidence: float
    language: str


class ProcessDemonstrationRequest(BaseModel):
    """Request to process a full demonstration."""

    demonstration_id: UUID
    skill_id: UUID
    video_url: str


class ProcessDemonstrationResponse(BaseModel):
    """Demonstration processing result."""

    demonstration_id: UUID
    transcript: str | None
    embedding: list[float] | None
    quality_score: float
    status: str


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    mock_mode: bool
