import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App General Settings
    APP_NAME: str = "AI Voice Deepfake Detector"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,http://localhost:8081"

    # Model and Dataset Settings
    MODEL_DIR: str = "./trained_model"
    DATASET_PATH: str = "/kaggle/input/datasets/awsaf49/asvpoof-2019-dataset/LA/LA/"
    BASE_MODEL_NAME: str = "facebook/wav2vec2-base"

    # Audio Pipeline Settings
    TARGET_SAMPLE_RATE: int = 16000
    CHUNK_DURATION: float = 3.0  # seconds per chunk
    CHUNK_OVERLAP: float = 1.0   # seconds overlap between chunks
    AI_THRESHOLD: float = 0.5    # Softmax binary classifier natural decision boundary (EER-calibrated for ASVspoof2019 LA)
    CLASSIFICATION_THRESHOLD: float = 0.5  # Alias for backward compatibility with REST routes
    SPEAKER_MATCH_THRESHOLD: float = 0.75  # Calibrated cosine decision threshold for 1-to-1 speaker verification

    # Proxy & Reverse Proxy Settings
    TRUST_PROXY_HEADERS: bool = False

    # Database Settings
    DATABASE_URL: str = "sqlite:///./voice_detector.db"

    def get_allowed_origins(self) -> list[str]:
        """Returns list of normalized allowed origins for CORS middleware."""
        raw = self.ALLOWED_ORIGINS or ""
        return [orig.strip() for orig in raw.split(",") if orig.strip()]

    def get_allowed_origins_set(self) -> set[str]:
        """Returns lowercase set of allowed origins for WebSocket and origin check validation."""
        return {orig.lower() for orig in self.get_allowed_origins()}

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
