import os
import torch
import numpy as np
import logging
from transformers import AutoFeatureExtractor, Wav2Vec2ForSequenceClassification
from config.settings import settings
from backend.ml.base import VoiceDetector, ChunkPrediction
from backend.ml.features import extract_acoustic_features

logger = logging.getLogger("VoiceDetector.TrainedAdapter")

class TrainedModelAdapter(VoiceDetector):
    """
    Loads fine-tuned Wav2Vec2 binary classifier from local model_dir (default: ./trained_model).
    Returns real model probabilities (is_demo_mode = False).
    """

    def __init__(self, model_dir: str = "./trained_model"):
        self._model_dir = model_dir
        if not os.path.exists(model_dir):
            raise FileNotFoundError(f"Model directory '{model_dir}' does not exist.")

        logger.info(f"Loading trained classifier from '{model_dir}'...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        try:
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(model_dir)
            self.model = Wav2Vec2ForSequenceClassification.from_pretrained(model_dir)
            self.model.to(self.device)
            self.model.eval()
            logger.info(f"Successfully loaded trained model on device: {self.device}")
        except Exception as e:
            raise RuntimeError(f"Failed to load fine-tuned model checkpoint from '{model_dir}': {e}")

    @property
    def is_demo_mode(self) -> bool:
        return False

    @property
    def model_name(self) -> str:
        return f"Fine-tuned Wav2Vec2 ({os.path.basename(self._model_dir)})"

    def predict_chunk(
        self,
        waveform_16k: np.ndarray,
        sample_rate: int = 16000,
        chunk_index: int = 0,
        start_time: float = 0.0
    ) -> ChunkPrediction:
        duration = len(waveform_16k) / float(sample_rate) if sample_rate > 0 else 0.0
        end_time = start_time + duration

        logger.info(f"[MODEL] --- Chunk {chunk_index} ---")
        logger.info(f"[MODEL] Sample rate    : {sample_rate} Hz")
        logger.info(f"[MODEL] Duration       : {duration:.3f}s (samples={len(waveform_16k)})")
        logger.info(f"[MODEL] Waveform dtype : {waveform_16k.dtype}")
        logger.info(f"[MODEL] Waveform stats : min={float(np.min(waveform_16k)):.4f}, max={float(np.max(waveform_16k)):.4f}, mean={float(np.mean(waveform_16k)):.6f}")
        logger.info(f"[MODEL] Waveform RMS   : {float(np.sqrt(np.mean(waveform_16k**2))):.6f}")

        # Extract features for explainability flags
        features = extract_acoustic_features(waveform_16k, sample_rate)

        # Handle tiny/silent chunks gracefully
        # NOTE: This fallback only fires for chunks < 100ms. It should NOT affect normal recordings.
        if len(waveform_16k) < sample_rate * 0.1:
            logger.warning(f"[MODEL] Chunk {chunk_index} is too short ({len(waveform_16k)} samples < {sample_rate * 0.1:.0f}). Returning fallback Human Genuine.")
            return ChunkPrediction(
                chunk_index=chunk_index,
                start_time=round(start_time, 2),
                end_time=round(end_time, 2),
                ai_probability=0.0,
                human_probability=1.0,
                classification="Human Genuine",
                confidence=1.0,
                features=features,
                is_demo_mode=False
            )

        # HuggingFace Wav2Vec2 feature extraction
        inputs = self.feature_extractor(
            waveform_16k,
            sampling_rate=sample_rate,
            return_tensors="pt",
            padding=True
        )

        input_values = inputs.input_values.to(self.device)
        logger.info(f"[MODEL] Tensor shape   : {tuple(input_values.shape)}")
        logger.info(f"[MODEL] Tensor dtype   : {input_values.dtype}")
        logger.info(f"[MODEL] Tensor stats   : min={input_values.min().item():.4f}, max={input_values.max().item():.4f}, mean={input_values.mean().item():.6f}")

        with torch.no_grad():
            outputs = self.model(input_values)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]

        raw_logits = logits.cpu().numpy()[0].tolist()
        logger.info(f"[MODEL] Raw logits     : {[round(l, 6) for l in raw_logits]}")
        logger.info(f"[MODEL] Probabilities  : {[round(float(p), 6) for p in probs]}")
        logger.info(f"[MODEL] Num outputs    : {len(probs)}")

        # Index 0: Bonafide / Human Genuine  (id2label: {"0": "Human Genuine"})
        # Index 1: Spoof   / AI Generated    (id2label: {"1": "AI Generated"})
        # This mapping is verified against: training label = 0 if bonafide else 1
        if len(probs) == 2:
            human_prob = float(probs[0])
            ai_prob = float(probs[1])
        elif len(probs) == 1:
            # Sigmoid single-output case (should not occur with Wav2Vec2ForSequenceClassification)
            ai_prob = float(probs[0])
            human_prob = float(1.0 - ai_prob)
            logger.warning(f"[MODEL] Single output detected — assuming sigmoid (ai_prob=probs[0])")
        else:
            # Unexpected: log all probs
            logger.error(f"[MODEL] Unexpected output size {len(probs)}: {probs.tolist()}")
            ai_prob = float(probs[-1])
            human_prob = float(probs[0])

        predicted_class_idx = int(np.argmax(probs))
        id2label = self.model.config.id2label
        predicted_label = id2label.get(predicted_class_idx, id2label.get(str(predicted_class_idx), "UNKNOWN"))

        logger.info(f"[MODEL] probs[0] (Human Genuine) : {human_prob:.6f}")
        logger.info(f"[MODEL] probs[1] (AI Generated)  : {ai_prob:.6f}")
        logger.info(f"[MODEL] Predicted class index    : {predicted_class_idx}")
        logger.info(f"[MODEL] Predicted label (argmax) : {predicted_label}")
        logger.info(f"[MODEL] AI_THRESHOLD             : {settings.AI_THRESHOLD}")

        classification = "AI Generated" if ai_prob >= settings.AI_THRESHOLD else "Human Genuine"
        confidence = float(max(ai_prob, human_prob))

        logger.info(f"[MODEL] Final classification     : {classification}")
        logger.info(f"[MODEL] Confidence               : {confidence:.6f}")

        return ChunkPrediction(
            chunk_index=chunk_index,
            start_time=round(start_time, 2),
            end_time=round(end_time, 2),
            ai_probability=round(ai_prob, 4),
            human_probability=round(human_prob, 4),
            classification=classification,
            confidence=round(confidence, 4),
            features=features,
            is_demo_mode=False
        )
