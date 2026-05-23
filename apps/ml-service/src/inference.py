"""FORGE MIND ML Service — Inference service (mock + real)."""

import random

import numpy as np

from .config import settings


class InferenceService:
    """Handles embedding, transcription, and skill quality scoring."""

    def __init__(self) -> None:
        self.mock_mode = settings.mock_inference
        self.embedding_dim = settings.embedding_dim
        self._encoder: object | None = None

    async def initialize(self) -> None:
        """Load models if not in mock mode."""
        if not self.mock_mode:
            from sentence_transformers import SentenceTransformer

            self._encoder = SentenceTransformer(settings.embedding_model)

    async def embed_text(self, text: str) -> list[float]:
        """Generate embedding for text."""
        if self.mock_mode:
            rng = np.random.default_rng(hash(text) % (2**32))
            vec = rng.standard_normal(self.embedding_dim).astype(np.float32)
            vec = vec / np.linalg.norm(vec)
            return vec.tolist()

        assert self._encoder is not None
        embedding = self._encoder.encode(text, normalize_embeddings=True)  # type: ignore[union-attr]
        return embedding.tolist()

    async def transcribe_video(self, video_url: str) -> tuple[str, float, str]:
        """Transcribe audio from video. Returns (transcript, confidence, language)."""
        if self.mock_mode:
            return (
                f"Mock transcription of video at {video_url}. "
                "The operator demonstrates picking up the part from the left bin, "
                "rotating it 90 degrees, and placing it into the fixture.",
                0.92,
                "en",
            )

        import whisper

        model = whisper.load_model("base")
        result = model.transcribe(video_url)
        text = result.get("text", "")
        language = result.get("language", "en")
        segments = result.get("segments", [])
        avg_confidence = (
            sum(s.get("no_speech_prob", 0) for s in segments) / len(segments)
            if segments
            else 0.5
        )
        return str(text), 1.0 - avg_confidence, str(language)

    async def score_quality(self, video_url: str, transcript: str) -> float:
        """Score demonstration quality (0.0 to 1.0)."""
        if self.mock_mode:
            base_score = 0.6
            length_bonus = min(len(transcript) / 500, 0.2)
            noise = random.uniform(-0.1, 0.1)
            return max(0.0, min(1.0, base_score + length_bonus + noise))

        # Real implementation would analyze video smoothness, completeness, etc.
        base_score = 0.5
        length_bonus = min(len(transcript) / 500, 0.3)
        return min(1.0, base_score + length_bonus)


inference_service = InferenceService()
