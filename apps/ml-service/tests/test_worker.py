"""Unit tests for the FORGE MIND ML Service worker loop."""

import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.worker import QUEUE_KEY, process_job


# ─── Fixtures ─────────────────────────────────────────────────────────────────


def _make_job() -> dict:
    return {
        "demonstration_id": "demo-uuid-1234",
        "skill_id": "skill-uuid-5678",
        "video_path": "s3://bucket/demo.mp4",
    }


def _make_api_client(
    status_demo: int = 200, status_embed: int = 200
) -> AsyncMock:
    """Return a mock httpx.AsyncClient with configurable status codes."""
    client = AsyncMock()

    demo_response = MagicMock()
    demo_response.status_code = status_demo
    demo_response.raise_for_status = MagicMock()

    embed_response = MagicMock()
    embed_response.status_code = status_embed
    embed_response.raise_for_status = MagicMock()

    client.patch = AsyncMock(side_effect=[demo_response, embed_response])
    return client


# ─── process_job tests ────────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("src.worker.inference_service")
async def test_process_job_calls_both_callbacks(mock_inference) -> None:
    """Worker must call both the demo-update and skill-embedding callbacks."""
    mock_inference.transcribe_video = AsyncMock(return_value=("Pick up the bracket", 0.9, "en"))
    mock_inference.embed_text = AsyncMock(return_value=[0.1] * 384)
    mock_inference.score_quality = AsyncMock(return_value=0.85)

    api_client = _make_api_client()
    await process_job(_make_job(), api_client)

    assert api_client.patch.call_count == 2


@pytest.mark.asyncio
@patch("src.worker.inference_service")
async def test_process_job_sends_internal_secret_header(mock_inference) -> None:
    """Both API callbacks must include the X-Internal-Secret header."""
    mock_inference.transcribe_video = AsyncMock(return_value=("text", 0.8, "en"))
    mock_inference.embed_text = AsyncMock(return_value=[0.0] * 384)
    mock_inference.score_quality = AsyncMock(return_value=0.7)

    from src.config import settings

    api_client = _make_api_client()
    await process_job(_make_job(), api_client)

    for call in api_client.patch.call_args_list:
        headers = call.kwargs.get("headers", {})
        assert "x-internal-secret" in headers
        assert headers["x-internal-secret"] == settings.internal_api_secret


@pytest.mark.asyncio
@patch("src.worker.inference_service")
async def test_process_job_first_callback_url_contains_demo_id(mock_inference) -> None:
    """First PATCH must target the demonstration endpoint with the correct ID."""
    mock_inference.transcribe_video = AsyncMock(return_value=("text", 0.9, "en"))
    mock_inference.embed_text = AsyncMock(return_value=[0.0] * 384)
    mock_inference.score_quality = AsyncMock(return_value=0.7)

    api_client = _make_api_client()
    job = _make_job()
    await process_job(job, api_client)

    demo_call_url = api_client.patch.call_args_list[0].args[0]
    assert job["demonstration_id"] in demo_call_url
    assert "demonstrations" in demo_call_url


@pytest.mark.asyncio
@patch("src.worker.inference_service")
async def test_process_job_second_callback_url_contains_skill_id(mock_inference) -> None:
    """Second PATCH must target the skill embedding endpoint with the correct ID."""
    mock_inference.transcribe_video = AsyncMock(return_value=("text", 0.9, "en"))
    mock_inference.embed_text = AsyncMock(return_value=[0.0] * 384)
    mock_inference.score_quality = AsyncMock(return_value=0.7)

    api_client = _make_api_client()
    job = _make_job()
    await process_job(job, api_client)

    embed_call_url = api_client.patch.call_args_list[1].args[0]
    assert job["skill_id"] in embed_call_url
    assert "embedding" in embed_call_url


@pytest.mark.asyncio
@patch("src.worker.inference_service")
async def test_process_job_sends_384_dim_embedding(mock_inference) -> None:
    """Embedding sent to the API must always be 384 dimensions."""
    expected_embedding = [float(i % 10) / 10 for i in range(384)]
    mock_inference.transcribe_video = AsyncMock(return_value=("text", 0.9, "en"))
    mock_inference.embed_text = AsyncMock(return_value=expected_embedding)
    mock_inference.score_quality = AsyncMock(return_value=0.7)

    api_client = _make_api_client()
    await process_job(_make_job(), api_client)

    embed_payload = api_client.patch.call_args_list[1].kwargs["json"]
    assert len(embed_payload["embedding"]) == 384


@pytest.mark.asyncio
@patch("src.worker.inference_service")
async def test_process_job_sends_transcript_and_quality(mock_inference) -> None:
    """Demo callback payload must contain voice_transcript and quality_score."""
    mock_inference.transcribe_video = AsyncMock(return_value=("Pick up the bracket", 0.9, "en"))
    mock_inference.embed_text = AsyncMock(return_value=[0.0] * 384)
    mock_inference.score_quality = AsyncMock(return_value=0.88)

    api_client = _make_api_client()
    await process_job(_make_job(), api_client)

    demo_payload = api_client.patch.call_args_list[0].kwargs["json"]
    assert demo_payload["voice_transcript"] == "Pick up the bracket"
    assert demo_payload["quality_score"] == pytest.approx(0.88)


@pytest.mark.asyncio
@patch("src.worker.inference_service")
async def test_process_job_exception_propagates(mock_inference) -> None:
    """Exceptions from inference service must propagate (so outer loop can log them)."""
    mock_inference.transcribe_video = AsyncMock(side_effect=RuntimeError("GPU OOM"))
    mock_inference.embed_text = AsyncMock(return_value=[0.0] * 384)
    mock_inference.score_quality = AsyncMock(return_value=0.0)

    api_client = _make_api_client()
    with pytest.raises(RuntimeError, match="GPU OOM"):
        await process_job(_make_job(), api_client)
