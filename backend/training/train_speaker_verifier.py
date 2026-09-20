"""
Option A: Speaker verification, trained by us on top of frozen ECAPA-TDNN
embeddings.

WHY THIS DESIGN (context for whoever runs this):
- The embedding extractor (speechbrain/spkrec-ecapa-voxceleb) is used
  FROZEN, exactly like wav2vec2's backbone in Layer 1 - we don't train it.
- What IS trained here, by us, on our own assembled data: a small
  classifier that decides "same speaker" vs "different speaker" from a
  pair of embeddings. This mirrors the Layer 1 pattern (frozen foundation +
  our own trained decision layer) rather than just hardcoding a fixed
  cosine-similarity cutoff.
- Uses ai4bharat/indicvoices_r - 10,496 distinct speakers across 22 Indian
  languages, with real speaker ID metadata. This REPLACES an earlier plan
  to use Mozilla Common Voice, which as of October 2025 was pulled from
  Hugging Face entirely and moved to a separate gated platform (Mozilla
  Data Collective) - no longer usable via the `datasets` library. This
  IndicVoices-R swap is a genuine upgrade, not just a workaround: far more
  Indian speakers than Common Voice's Hindi subset would have given us,
  and purpose-built for Indian speaker-generalization research (see
  I-MSV Challenge 2022 finding referenced in the project handoff notes -
  ECAPA-TDNN needs explicit domain adaptation to Indian speakers).
- No Hugging Face gating/token needed for this dataset (unlike Common
  Voice) - open access.

Run:
    pip install speechbrain datasets torch scikit-learn
    python training/train_speaker_verifier.py
"""
import os
import sys
import logging
from pathlib import Path
from collections import defaultdict

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.audio.preprocess import preprocess_audio
from config.settings import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SpeakerVerifierTraining")

TARGET_SR = settings.TARGET_SAMPLE_RATE
NUM_PAIRS = 4000          # total pairs to build (half positive, half negative)
MAX_SPEAKERS = 100        # cap distinct speakers pulled, keeps this fast (lowered from 300 - real-world scan rate was much slower than estimated)
EMBEDDING_DIM = 192       # ECAPA-TDNN's standard output size
DATASET_NAME = "ai4bharat/indicvoices_r"
SPEAKER_ID_FIELD = "speaker_id"  # verify this matches the dataset's actual field name - check via the diagnostic snippet in the guide before running the full pair-build

# This dataset is gated on Hugging Face (confirmed via DatasetNotFoundError
# during testing - contrary to an earlier assumption that it was open).
# Requires: (1) a free HF account, (2) accepting the dataset's terms at
# https://huggingface.co/datasets/ai4bharat/indicvoices_r, (3) a token from
# https://huggingface.co/settings/tokens, set as the HF_TOKEN environment
# variable before running this script.
HF_TOKEN = os.environ.get("HF_TOKEN")


def load_embedding_model():
    """Loads the frozen, pretrained ECAPA-TDNN speaker embedding model.
    Never trained/fine-tuned - used purely as a feature extractor."""
    from speechbrain.inference.speaker import EncoderClassifier
    logger.info("Loading pretrained ECAPA-TDNN (speechbrain/spkrec-ecapa-voxceleb)...")
    model = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir="./pretrained_ecapa",
    )
    logger.info("Embedding model loaded (frozen, not being trained).")
    return model


def extract_embedding(embedding_model, waveform_16k: np.ndarray) -> np.ndarray:
    """Runs one audio clip through the frozen extractor -> fixed-length vector."""
    tensor = torch.tensor(waveform_16k, dtype=torch.float32).unsqueeze(0)
    with torch.no_grad():
        emb = embedding_model.encode_batch(tensor)
    return emb.squeeze().cpu().numpy()


def build_speaker_pairs():
    """
    Streams ai4bharat/indicvoices_r, groups clips by speaker, and builds a
    balanced set of same-speaker (positive) and different-speaker
    (negative) pairs. Returns a list of (embedding_a, embedding_b, label).

    Uses streaming mode deliberately - this dataset is large (1,704 hours
    total), and we only need a few hundred speakers' worth of clips, not
    the entire corpus. See the disk-space lesson from the ASVspoof v3
    retrain: always stream when only sampling a subset of a large dataset.
    """
    from datasets import load_dataset

    logger.info(f"Streaming '{DATASET_NAME}' (Hindi config) to find usable speakers...")
    # decode audio to False: avoids datasets' built-in Audio decoder (which
    # requires torchcodec + a full system FFmpeg install - unreliable on
    # Windows, same category of problem as the original m4a upload bug).
    # We decode manually via soundfile below instead, matching the rest of
    # this project's audio pipeline.
    from datasets import Audio
    ds = load_dataset(DATASET_NAME, "Hindi", split="train", streaming=True, token=HF_TOKEN)
    ds = ds.cast_column("audio", Audio(decode=False))

    # Group clip indices by speaker (streamed - collect just enough)
    speaker_to_clips = defaultdict(list)
    scanned = 0
    # Safety cap: stop scanning after this many rows regardless of speaker
    # count found, so a slow/sparse dataset can't run indefinitely. Learned
    # from an actual run that was still scanning after 22+ minutes with no
    # visibility into progress.
    MAX_ROWS_TO_SCAN = 8000

    for row in ds:
        speaker_id = row.get(SPEAKER_ID_FIELD)
        if speaker_id is None:
            raise KeyError(
                f"'{SPEAKER_ID_FIELD}' not found in dataset row. Available keys: {list(row.keys())}. "
                f"Update SPEAKER_ID_FIELD at the top of this file to match."
            )
        speaker_to_clips[speaker_id].append(row)
        scanned += 1

        # Progress visibility every 200 rows, so a long scan doesn't look stuck
        if scanned % 200 == 0:
            usable_so_far = sum(1 for clips in speaker_to_clips.values() if len(clips) >= 2)
            logger.info(f"  ...scanned {scanned} rows so far, {len(speaker_to_clips)} distinct speakers seen, {usable_so_far} usable (2+ clips).")

        if len(speaker_to_clips) >= MAX_SPEAKERS and scanned > MAX_SPEAKERS * 15:
            break
        if scanned >= MAX_ROWS_TO_SCAN:
            logger.warning(f"Hit MAX_ROWS_TO_SCAN ({MAX_ROWS_TO_SCAN}) safety cap - stopping scan with whatever speakers were found so far.")
            break

    speaker_to_clips = {k: v for k, v in speaker_to_clips.items() if len(v) >= 2}
    speaker_ids = list(speaker_to_clips.keys())
    logger.info(f"Found {len(speaker_ids)} usable speakers with 2+ clips each (scanned {scanned} rows).")

    if len(speaker_ids) < 2:
        raise RuntimeError("Not enough distinct speakers found to build pairs.")

    embedding_model = load_embedding_model()
    rng = np.random.default_rng(42)
    pairs = []

    def get_audio_embedding(row):
        # With Audio(decode=False), row["audio"] is raw {"bytes": ..., "path": ...}
        # instead of a pre-decoded array - decode manually via soundfile,
        # same library used everywhere else in this project's audio pipeline.
        import io
        import soundfile as sf
        audio_bytes = row["audio"]["bytes"]
        raw_audio, orig_sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
        audio_16k, _ = preprocess_audio(raw_audio, orig_sr=orig_sr, target_sr=TARGET_SR)
        return extract_embedding(embedding_model, audio_16k)

    logger.info("Building positive (same-speaker) pairs...")
    for _ in range(NUM_PAIRS // 2):
        speaker = speaker_ids[rng.integers(0, len(speaker_ids))]
        clip_a, clip_b = rng.choice(speaker_to_clips[speaker], size=2, replace=False)
        try:
            pairs.append((get_audio_embedding(clip_a), get_audio_embedding(clip_b), 1))
        except Exception as e:
            logger.warning(f"Skipping a positive pair due to error: {e}")

    logger.info("Building negative (different-speaker) pairs...")
    for _ in range(NUM_PAIRS // 2):
        speaker_a, speaker_b = rng.choice(speaker_ids, size=2, replace=False)
        clip_a = rng.choice(speaker_to_clips[speaker_a])
        clip_b = rng.choice(speaker_to_clips[speaker_b])
        try:
            pairs.append((get_audio_embedding(clip_a), get_audio_embedding(clip_b), 0))
        except Exception as e:
            logger.warning(f"Skipping a negative pair due to error: {e}")

    logger.info(f"Built {len(pairs)} total embedding pairs.")
    return pairs


class PairDataset(Dataset):
    """Wraps (embedding_a, embedding_b, label) tuples for training.
    Feature = elementwise absolute difference between the two embeddings -
    a standard, simple way to feed a pair into a classifier."""
    def __init__(self, pairs):
        self.pairs = pairs

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        emb_a, emb_b, label = self.pairs[idx]
        diff = np.abs(emb_a - emb_b).astype(np.float32)
        return torch.tensor(diff), torch.tensor(label, dtype=torch.float32)


class SpeakerMatchClassifier(nn.Module):
    """The actual model being TRAINED by us in this script - a small
    feedforward network deciding same/different speaker from an embedding
    difference vector. This is the genuinely-ours component."""
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


def train_classifier(pairs, output_path: str = "./trained_speaker_verifier"):
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score, accuracy_score

    train_pairs, val_pairs = train_test_split(pairs, test_size=0.2, random_state=42)
    train_loader = DataLoader(PairDataset(train_pairs), batch_size=32, shuffle=True)
    val_loader = DataLoader(PairDataset(val_pairs), batch_size=32, shuffle=False)

    model = SpeakerMatchClassifier()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCEWithLogitsLoss()

    logger.info("Training speaker-match classifier (small model, trains in minutes on CPU)...")
    for epoch in range(15):
        model.train()
        total_loss = 0.0
        for x, y in train_loader:
            optimizer.zero_grad()
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        model.eval()
        all_probs, all_labels = [], []
        with torch.no_grad():
            for x, y in val_loader:
                probs = torch.sigmoid(model(x))
                all_probs.extend(probs.numpy())
                all_labels.extend(y.numpy())

        preds = [1 if p >= 0.5 else 0 for p in all_probs]
        acc = accuracy_score(all_labels, preds)
        try:
            auc = roc_auc_score(all_labels, all_probs)
        except Exception:
            auc = 0.5

        logger.info(f"Epoch {epoch+1}/15 - train_loss: {total_loss/len(train_loader):.4f} - val_acc: {acc:.4f} - val_auc: {auc:.4f}")

    output_dir = Path(output_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), output_dir / "speaker_match_classifier.pt")
    logger.info(f"✅ Saved trained speaker-match classifier to: {output_dir.resolve()}")

    return model


if __name__ == "__main__":
    if not HF_TOKEN:
        logger.error(
            "HF_TOKEN environment variable not set. 'ai4bharat/indicvoices_r' is gated - "
            "see the constants near the top of this file for the one-time setup steps "
            "(create HF account, accept dataset terms, generate a token, set HF_TOKEN)."
        )
        sys.exit(1)

    pairs = build_speaker_pairs()
    train_classifier(pairs)
