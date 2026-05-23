"""Edge case tests for FORGE MIND ML Service API."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ─── Embed edge cases ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_embed_empty_string(client: AsyncClient) -> None:
    """Empty input should return a zero or near-zero embedding, not error."""
    resp = await client.post("/api/v1/embed", json={"text": ""})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["embedding"]) == 384


@pytest.mark.asyncio
async def test_embed_very_long_text(client: AsyncClient) -> None:
    """Text exceeding 512 tokens should be handled gracefully (truncated or chunked)."""
    long_text = "pick up the bracket and place it on the fixture " * 100
    resp = await client.post("/api/v1/embed", json={"text": long_text})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["embedding"]) == 384


@pytest.mark.asyncio
async def test_embed_non_ascii_text(client: AsyncClient) -> None:
    """Non-ASCII / multilingual text should produce a valid embedding."""
    resp = await client.post("/api/v1/embed", json={"text": "ロボットを動かす — déplacer le robot"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["embedding"]) == 384


@pytest.mark.asyncio
async def test_embed_unicode_whitespace_only(client: AsyncClient) -> None:
    """Whitespace-only input should succeed."""
    resp = await client.post("/api/v1/embed", json={"text": "   \t\n  "})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["embedding"]) == 384


@pytest.mark.asyncio
async def test_embed_missing_text_field(client: AsyncClient) -> None:
    """Missing 'text' field should return 422 Unprocessable Entity."""
    resp = await client.post("/api/v1/embed", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_embed_wrong_content_type(client: AsyncClient) -> None:
    """Non-JSON request should return 422."""
    resp = await client.post(
        "/api/v1/embed",
        content="pick up bracket",
        headers={"Content-Type": "text/plain"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_embed_returns_correct_dimensions(client: AsyncClient) -> None:
    """Embedding dimensions field must match actual vector length."""
    resp = await client.post("/api/v1/embed", json={"text": "test"})
    data = resp.json()
    assert data["dimensions"] == len(data["embedding"]) == 384


# ─── Transcribe edge cases ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_transcribe_missing_video_url(client: AsyncClient) -> None:
    """Missing 'video_url' field should return 422."""
    resp = await client.post("/api/v1/transcribe", json={"skill_id": "00000000-0000-0000-0000-000000001000"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_transcribe_missing_skill_id(client: AsyncClient) -> None:
    """Missing 'skill_id' field should return 422."""
    resp = await client.post("/api/v1/transcribe", json={"video_url": "s3://bucket/demo.mp4"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_transcribe_response_structure(client: AsyncClient) -> None:
    """Transcribe response must have required fields with correct types."""
    resp = await client.post(
        "/api/v1/transcribe",
        json={
            "video_url": "s3://bucket/demo.mp4",
            "skill_id": "00000000-0000-0000-0000-000000001000",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["transcript"], str)
    assert isinstance(data["confidence"], float)
    assert 0.0 <= data["confidence"] <= 1.0
    assert isinstance(data["language"], str)


# ─── Process-demonstration edge cases ────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_demonstration_missing_fields(client: AsyncClient) -> None:
    """Missing required fields should return 422."""
    resp = await client.post("/api/v1/process-demonstration", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_process_demonstration_partial_fields(client: AsyncClient) -> None:
    """Only demonstration_id without video_url should return 422."""
    resp = await client.post(
        "/api/v1/process-demonstration",
        json={"demonstration_id": "00000000-0000-0000-0000-000000002000"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_process_demonstration_full_response(client: AsyncClient) -> None:
    """Full response should contain all expected fields."""
    resp = await client.post(
        "/api/v1/process-demonstration",
        json={
            "demonstration_id": "00000000-0000-0000-0000-000000002000",
            "skill_id": "00000000-0000-0000-0000-000000001000",
            "video_url": "s3://bucket/demo.mp4",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert isinstance(data["transcript"], str)
    assert len(data["embedding"]) == 384
    assert 0.0 <= data["quality_score"] <= 1.0
    assert data["demonstration_id"] == "00000000-0000-0000-0000-000000002000"
