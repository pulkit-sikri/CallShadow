from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class ChunkPrediction(BaseModel):
    chunk_index: int = 0
    start_time: float = 0.0
    end_time: float = 0.0
    ai_probability: float
    human_probability: float
    classification: str  # "AI Generated" or "Human Genuine"
    confidence: float
    features: Dict[str, float] = Field(default_factory=dict)
    is_demo_mode: bool = False

class VoiceDetector(ABC):
    """
    Abstract interface for AI Voice Deepfake Detectors.
    """

    @property
    @abstractmethod
    def is_demo_mode(self) -> bool:
        """Returns True if operating under acoustic fallback demo mode."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Returns descriptive name of active classifier model."""
        pass

    @abstractmethod
    def predict_chunk(self, waveform_16k: Any, sample_rate: int = 16000, chunk_index: int = 0, start_time: float = 0.0) -> ChunkPrediction:
        """
        Runs binary inference on a single 16kHz mono audio waveform array.
        """
        pass
