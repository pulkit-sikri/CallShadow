import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App General Settings
    APP_NAME: str = "AI Voice Deepfake Detector"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

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

    # Database Settings
    DATABASE_URL: str = "sqlite:///./voice_detector.db"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
