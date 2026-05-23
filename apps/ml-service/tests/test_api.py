"""Tests for FORGE MIND ML Service."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["mock_mode"] is True


@pytest.mark.asyncio
async def test_embed_text(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/embed", json={"text": "pick up the bracket"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["embedding"]) == 384
    assert data["dimensions"] == 384


@pytest.mark.asyncio
async def test_embed_deterministic(client: AsyncClient) -> None:
    text = "pick up the bracket"
    resp1 = await client.post("/api/v1/embed", json={"text": text})
    resp2 = await client.post("/api/v1/embed", json={"text": text})
    assert resp1.json()["embedding"] == resp2.json()["embedding"]


@pytest.mark.asyncio
async def test_embed_different_texts_different_vectors(client: AsyncClient) -> None:
    resp1 = await client.post("/api/v1/embed", json={"text": "pick up bracket"})
    resp2 = await client.post("/api/v1/embed", json={"text": "insert screw"})
    assert resp1.json()["embedding"] != resp2.json()["embedding"]


@pytest.mark.asyncio
async def test_transcribe(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/transcribe",
        json={
            "video_url": "s3://bucket/demo.mp4",
            "skill_id": "00000000-0000-0000-0000-000000001000",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["transcript"]) > 0
    assert 0.0 <= data["confidence"] <= 1.0
    assert data["language"] == "en"


@pytest.mark.asyncio
async def test_process_demonstration(client: AsyncClient) -> None:
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
    assert data["transcript"] is not None
    assert data["embedding"] is not None
    assert len(data["embedding"]) == 384
    assert 0.0 <= data["quality_score"] <= 1.0
