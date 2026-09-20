"""
Speaker Verifier Interface Module.
Prepares the interface for future voice biometrics and speaker verification integrations.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import numpy as np

from backend.models.schemas import SpeakerVerificationResult


class SpeakerVerifierInterface(ABC):
    """
    Abstract interface for future Speaker Verification & Voice Biometrics integrations.
    """

    @abstractmethod
    def register_speaker(self, speaker_id: str, waveform_16k: np.ndarray) -> bool:
        """Registers a speaker's vocal embedding."""
        pass

    @abstractmethod
    def verify_speaker(self, speaker_id: str, waveform_16k: np.ndarray) -> SpeakerVerificationResult:
        """Verifies claimed speaker identity against registered embedding."""
        pass

    @abstractmethod
    def compare_embeddings(self, embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
        """Computes cosine similarity between two voice embeddings."""
        pass


class SpeakerVerifierStub(SpeakerVerifierInterface):
    """
    Stub implementation of SpeakerVerifierInterface.
    Returns clear NOT_IMPLEMENTED states without fabricating fake identity scores.
    """

    def __init__(self):
        self.registered_speakers: Dict[str, Any] = {}

    def register_speaker(self, speaker_id: str, waveform_16k: np.ndarray) -> bool:
        self.registered_speakers[speaker_id] = True
        return True

    def verify_speaker(self, speaker_id: str, waveform_16k: np.ndarray) -> SpeakerVerificationResult:
        return SpeakerVerificationResult(
            verified=False,
            similarity_score=None,
            registered_speaker_id=speaker_id,
            message="Speaker verification model not active in current MVP pipeline.",
        )

    def compare_embeddings(self, embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
        return 0.0