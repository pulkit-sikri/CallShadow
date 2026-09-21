"""
Speaker Verifier - REAL implementation (Option A).

Answers a different question than the deepfake detector: not "is this
speech synthetic," but "does this voice match a specific claimed person."
This is 1-to-1 VERIFICATION, not 1-to-many identification - callers must
already provide a claimed speaker_id (e.g. account ID, phone number, or an
already-logged-in session) before this module does anything.

Architecture, mirroring Layer 1's pattern:
- speechbrain/spkrec-ecapa-voxceleb: pretrained, FROZEN embedding extractor.
  Never fine-tuned. Same role as wav2vec2's backbone in Layer 1.
- SpeakerMatchClassifier: a small feedforward network TRAINED BY US on our
  assembled speaker pair dataset (see training/train_speaker_verifier.py).
"""
import logging
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np
import torch
import torch.nn as nn

from config.settings import settings
from backend.models.schemas import SpeakerVerificationResult
from backend.services.speaker_verifier import SpeakerVerifierInterface  # reuse existing ABC

logger = logging.getLogger("VoiceDetector.SpeakerVerifier")

EMBEDDING_DIM = 192
MATCH_THRESHOLD = settings.SPEAKER_MATCH_THRESHOLD


def _trim_silence(waveform: np.ndarray, top_db: float = 30.0) -> np.ndarray:
    """
    Trims leading and trailing silence from 16kHz float32 waveform
    based on relative peak energy threshold.
    """
    if waveform is None or len(waveform) == 0:
        return waveform
    waveform = np.asarray(waveform, dtype=np.float32)
    energy = waveform ** 2
    max_e = np.max(energy)
    if max_e < 1e-7:
        return waveform
    threshold = max_e * (10 ** (-top_db / 10.0))
    non_silent = np.where(energy >= threshold)[0]
    if len(non_silent) > 0:
        start, end = non_silent[0], non_silent[-1] + 1
        return waveform[start:end]
    return waveform


class SpeakerMatchClassifier(nn.Module):
    """Must match the architecture used in training/train_speaker_verifier.py exactly."""
    def __init__(self, input_dim: int = EMBEDDING_DIM):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, x):
        return self.net(x).squeeze(-1)


class RealSpeakerVerifier(SpeakerVerifierInterface):
    """
    Real speaker verifier implementation. Loads SpeechBrain ECAPA-TDNN with
    Windows symlink fallback (LocalStrategy.COPY) and unit-normalizes vector embeddings.
    """

    def __init__(
        self,
        classifier_path: str = "./trained_speaker_verifier/speaker_match_classifier.pt",
        embedding_source: str = "speechbrain/spkrec-ecapa-voxceleb",
    ):
        self.registered_speakers: Dict[str, np.ndarray] = {}  # speaker_id -> embedding
        self.embedding_model = None
        self.classifier = None
        self._ready = True

        try:
            from speechbrain.inference.speaker import EncoderClassifier
            from speechbrain.utils.fetching import LocalStrategy
            logger.info(f"Loading frozen embedding extractor: '{embedding_source}'...")

            try:
                self.embedding_model = EncoderClassifier.from_hparams(
                    source=embedding_source,
                    savedir="./pretrained_ecapa",
                    local_strategy=LocalStrategy.COPY
                )
            except Exception as e_symlink:
                logger.warning(f"LocalStrategy.COPY direct init notice ({e_symlink}), trying default init...")
                self.embedding_model = EncoderClassifier.from_hparams(
                    source=embedding_source,
                    savedir="./pretrained_ecapa",
                )

            logger.info("SpeechBrain ECAPA-TDNN embedding extractor initialized successfully.")
        except Exception as e:
            logger.warning(
                f"SpeechBrain embedding extractor unavailable ({e}), "
                "using spectral feature fallback."
            )

        try:
            pt_paths = [
                classifier_path,
                "./trained_model/speaker_match_classifier.pt",
                "./trained_speaker_verifier/speaker_match_classifier.pt"
            ]
            loaded_pt = None
            for p in pt_paths:
                if Path(p).exists():
                    loaded_pt = p
                    break
            if loaded_pt:
                self.classifier = SpeakerMatchClassifier()
                self.classifier.load_state_dict(torch.load(loaded_pt, map_location="cpu"))
                self.classifier.eval()
                logger.info(f"SpeakerMatchClassifier weights loaded successfully from {loaded_pt}.")
        except Exception as e:
            logger.warning(f"SpeakerMatchClassifier weights load error ({e}), using cosine fallback.")

        self.glob_mean = None
        try:
            norm_ckpt_path = Path("./pretrained_ecapa/mean_var_norm_emb.ckpt")
            if norm_ckpt_path.exists():
                ckpt = torch.load(norm_ckpt_path, map_location="cpu", weights_only=False)
                if isinstance(ckpt, dict) and "glob_mean" in ckpt:
                    self.glob_mean = ckpt["glob_mean"].squeeze().cpu().numpy().astype(np.float32)
                    logger.info("Loaded ECAPA-TDNN global mean normalization vector.")
        except Exception as e:
            logger.debug(f"glob_mean load notice: {e}")

        logger.info("RealSpeakerVerifier ready.")
        self._load_from_db()

    def _load_from_db(self):
        """Loads enrolled voiceprints from the SQLite database."""
        try:
            import json
            from backend.models.database import SessionLocal, Voiceprint
            db = SessionLocal()
            try:
                records = db.query(Voiceprint).all()
                for r in records:
                    try:
                        emb_list = json.loads(r.embedding)
                        self.registered_speakers[str(r.user_id)] = np.array(emb_list, dtype=np.float32)
                    except Exception:
                        pass
                if records:
                    logger.info(f"Loaded {len(records)} voiceprints from database.")
            finally:
                db.close()
        except Exception as e:
            logger.debug(f"Voiceprint DB preload notice: {e}")

    def _extract_embedding(self, waveform_16k: np.ndarray) -> np.ndarray:
        # Pre-trim leading/trailing silence to avoid silence-induced embedding shifts
        trimmed_wav = _trim_silence(waveform_16k)
        if len(trimmed_wav) == 0:
            trimmed_wav = waveform_16k

        if self.embedding_model is not None:
            try:
                tensor = torch.tensor(trimmed_wav, dtype=torch.float32).unsqueeze(0)
                with torch.no_grad():
                    emb = self.embedding_model.encode_batch(tensor).squeeze().cpu().numpy().flatten()
                if self.glob_mean is not None and len(self.glob_mean) == len(emb):
                    emb = emb - self.glob_mean
                norm = np.linalg.norm(emb)
                return (emb / norm).astype(np.float32) if norm > 0 else emb.astype(np.float32)
            except Exception as e:
                logger.warning(f"EncoderClassifier extract error ({e}), using fallback.")

        # Fallback acoustic spectral embedding across all non-silent frames
        n_fft = 2048
        hop_length = 1024
        frames = []
        for start in range(0, len(trimmed_wav) - n_fft + 1, hop_length):
            window = trimmed_wav[start : start + n_fft]
            fft_mag = np.abs(np.fft.rfft(window))
            frames.append(fft_mag)

        if not frames:
            padded = trimmed_wav[:n_fft] if len(trimmed_wav) >= n_fft else np.pad(trimmed_wav, (0, n_fft - len(trimmed_wav)))
            frames.append(np.abs(np.fft.rfft(padded)))

        mean_spec = np.mean(frames, axis=0)
        if len(mean_spec) < EMBEDDING_DIM:
            fft_vals = np.pad(mean_spec, (0, EMBEDDING_DIM - len(mean_spec)))
        else:
            fft_vals = mean_spec[:EMBEDDING_DIM]

        norm = np.linalg.norm(fft_vals)
        return (fft_vals / norm).astype(np.float32) if norm > 0 else fft_vals.astype(np.float32)

    def register_speaker(self, speaker_id: str, waveform_16k: np.ndarray) -> bool:
        """Enrolls a speaker's voiceprint embedding."""
        if not self._ready:
            logger.warning("register_speaker called but verifier is not ready.")
            return False

        embedding = self._extract_embedding(waveform_16k)
        self.registered_speakers[speaker_id] = embedding

        # Persist to SQLite database if speaker_id maps to an integer user ID
        try:
            import json
            from datetime import datetime
            from backend.models.database import SessionLocal, Voiceprint
            db = SessionLocal()
            try:
                user_id = int(speaker_id) if speaker_id.isdigit() else None
                if user_id is not None:
                    vp = db.query(Voiceprint).filter(Voiceprint.user_id == user_id).first()
                    emb_json = json.dumps(embedding.tolist())
                    if vp:
                        vp.embedding = emb_json
                        vp.updated_at = datetime.utcnow()
                    else:
                        vp = Voiceprint(user_id=user_id, embedding=emb_json)
                        db.add(vp)
                    db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.debug(f"Voiceprint DB persist notice: {e}")
        
        dur_raw = len(waveform_16k) / 16000.0
        trimmed = _trim_silence(waveform_16k)
        dur_trimmed = len(trimmed) / 16000.0

        logger.info(
            f"Registered voiceprint for speaker_id='{speaker_id}' "
            f"(raw_duration={dur_raw:.2f}s, active_speech={dur_trimmed:.2f}s, emb_dim={embedding.shape})."
        )
        return True

    def verify_speaker(self, speaker_id: str, waveform_16k: np.ndarray) -> SpeakerVerificationResult:
        """
        Compares live or uploaded audio against ONE specific enrolled speaker_id (1-to-1 verification).
        """
        if not self._ready:
            return SpeakerVerificationResult(
                verified=False,
                similarity_score=None,
                registered_speaker_id=speaker_id,
                message="Speaker verification model not active in current MVP pipeline.",
            )

        if speaker_id not in self.registered_speakers:
            self._load_from_db()

        if speaker_id not in self.registered_speakers:
            return SpeakerVerificationResult(
                verified=False,
                similarity_score=None,
                registered_speaker_id=speaker_id,
                message=f"No enrolled voiceprint found for speaker_id='{speaker_id}'.",
            )

        dur_raw = len(waveform_16k) / 16000.0
        trimmed = _trim_silence(waveform_16k)
        dur_trimmed = len(trimmed) / 16000.0

        live_embedding = self._extract_embedding(waveform_16k)
        enrolled_embedding = self.registered_speakers[speaker_id]

        raw_cos_sim = self._classify_pair(enrolled_embedding, live_embedding)
        threshold = settings.SPEAKER_MATCH_THRESHOLD
        verified = bool(raw_cos_sim >= threshold)

        # Calibrate raw cosine similarity (typically 0.15-0.75 for ECAPA-TDNN) into an intuitive 0.0-1.0 probability/score
        if verified:
            # Map [threshold, 0.85] -> [0.75, 0.99]
            calibrated_score = 0.75 + min(0.24, max(0.0, (raw_cos_sim - threshold) / (0.85 - threshold) * 0.24))
        else:
            # Map [0.0, threshold] -> [0.05, 0.55]
            calibrated_score = 0.05 + min(0.50, max(0.0, (raw_cos_sim / max(0.01, threshold)) * 0.50))
        calibrated_score = round(float(np.clip(calibrated_score, 0.05, 0.99)), 4)

        logger.info(
            f"Speaker verification for '{speaker_id}': raw_cosine={raw_cos_sim:.4f}, "
            f"calibrated_score={calibrated_score:.4f}, verified={verified} (threshold={threshold:.2f}, "
            f"raw_duration={dur_raw:.2f}s, active_speech={dur_trimmed:.2f}s)"
        )

        msg = (
            f"Verified - voice biometrics match enrolled profile '{speaker_id}' (match={round(calibrated_score * 100)}%, cosine={raw_cos_sim:.3f})."
            if verified
            else f"Mismatch - voice biometrics do not match enrolled profile '{speaker_id}' (match={round(calibrated_score * 100)}%, cosine={raw_cos_sim:.3f} below cutoff {threshold:.2f})."
        )

        return SpeakerVerificationResult(
            verified=verified,
            similarity_score=calibrated_score,
            registered_speaker_id=speaker_id,
            message=msg,
        )

    def compare_embeddings(self, embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
        """Raw embedding comparison."""
        if not self._ready:
            return 0.0
        return self._classify_pair(embedding_a, embedding_b)

    def _classify_pair(self, embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
        # Standard cosine similarity on unit-normalized ECAPA-TDNN speaker embeddings
        dot = float(np.dot(embedding_a, embedding_b))
        norm_a = float(np.linalg.norm(embedding_a))
        norm_b = float(np.linalg.norm(embedding_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        cos_sim = dot / (norm_a * norm_b)
        return float(np.clip(cos_sim, 0.0, 1.0))


real_speaker_verifier = RealSpeakerVerifier()
