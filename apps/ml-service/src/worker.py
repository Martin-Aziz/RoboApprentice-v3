"""FORGE MIND ML Service — Worker that processes demonstration jobs from Redis queue."""

import asyncio
import json
import logging

import httpx
import redis.asyncio as redis

from .config import settings
from .inference import inference_service

logger = logging.getLogger(__name__)

QUEUE_KEY = "queue:demonstration:process"


async def process_job(job_data: dict[str, str], api_client: httpx.AsyncClient) -> None:
    """Process a single demonstration job."""
    demonstration_id = job_data["demonstration_id"]
    skill_id = job_data["skill_id"]
    video_path = job_data["video_path"]

    logger.info("Processing demonstration %s for skill %s", demonstration_id, skill_id)

    transcript, confidence, _language = await inference_service.transcribe_video(video_path)
    embedding = await inference_service.embed_text(transcript)
    quality_score = await inference_service.score_quality(video_path, transcript)

    logger.info(
        "Demonstration %s processed: quality=%.2f, transcript_len=%d",
        demonstration_id,
        quality_score,
        len(transcript),
    )

    internal_headers = {"x-internal-secret": settings.internal_api_secret}

    # Update demonstration via Core API (internal endpoint)
    await api_client.patch(
        f"{settings.core_api_url}/internal/demonstrations/{demonstration_id}",
        json={
            "voice_transcript": transcript,
            "quality_score": quality_score,
        },
        headers=internal_headers,
        timeout=10.0,
    )

    # Update skill embedding
    await api_client.patch(
        f"{settings.core_api_url}/internal/skills/{skill_id}/embedding",
        json={"embedding": embedding},
        headers=internal_headers,
        timeout=10.0,
    )


async def worker_loop() -> None:
    """Main worker loop — blocks on Redis queue."""
    await inference_service.initialize()

    r = redis.from_url(settings.redis_url)
    api_client = httpx.AsyncClient()

    logger.info("ML Worker started, listening on queue: %s", QUEUE_KEY)

    try:
        while True:
            result = await r.brpop(QUEUE_KEY, timeout=5)
            if result is None:
                continue

            _key, raw = result
            try:
                job_data = json.loads(raw)
                await process_job(job_data, api_client)
            except Exception:
                logger.exception("Failed to process job: %s", raw)
    finally:
        await api_client.aclose()
        await r.aclose()


def main() -> None:
    """Entry point for the worker process."""
    logging.basicConfig(level=settings.log_level.upper())
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
