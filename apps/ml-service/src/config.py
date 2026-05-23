"""FORGE MIND ML Service — Configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    host: str = "0.0.0.0"
    port: int = 8001
    redis_url: str = "redis://localhost:6379"
    core_api_url: str = "http://localhost:3001"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dim: int = 384
    use_gpu: bool = False
    mock_inference: bool = True
    log_level: str = "info"
    internal_api_secret: str = "dev-internal-secret"

    model_config = {"env_prefix": "ML_"}


settings = Settings()
