import os
import sys
import argparse
import logging
from pathlib import Path
import numpy as np

# Ensure root directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.settings import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("DatasetVerifier")

def verify_dataset_structure(dataset_path: str = None) -> bool:
    """
    Verifies that the ASVspoof2019 LA dataset exists and is correctly structured
    at the specified path (or settings.DATASET_PATH).
    
    Expected structure:
    DATASET_PATH/
    ├── ASVspoof2019_LA_train/flac/
    ├── ASVspoof2019_LA_dev/flac/
    ├── ASVspoof2019_LA_eval/flac/
    └── ASVspoof2019_LA_cm_protocols/
        ├── ASVspoof2019.LA.cm.train.trn.txt
        ├── ASVspoof2019.LA.cm.dev.trl.txt
        └── ASVspoof2019.LA.cm.eval.trl.txt
    """
    base_dir = Path(dataset_path or settings.DATASET_PATH)
    logger.info(f"Verifying ASVspoof2019 dataset at: '{base_dir}'...")

    if not base_dir.exists():
        logger.error(
            f"\n❌ DATASET DIRECTORY NOT FOUND: '{base_dir}'\n"
            "If running on Kaggle, verify dataset mounting at '/kaggle/input/datasets/awsaf49/asvpoof-2019-dataset/LA/LA/'.\n"
            "If running locally for dry-run testing, set environment variable DATASET_PATH=./data/LA/LA\n"
            "or run 'python training/download_dataset.py --create-mock' to generate local test data."
        )
        return False

    protocol_dir = base_dir / "ASVspoof2019_LA_cm_protocols"
    protocols = {
        "train": protocol_dir / "ASVspoof2019.LA.cm.train.trn.txt",
        "dev": protocol_dir / "ASVspoof2019.LA.cm.dev.trl.txt",
        "eval": protocol_dir / "ASVspoof2019.LA.cm.eval.trl.txt",
    }

    flac_dirs = {
        "train": base_dir / "ASVspoof2019_LA_train" / "flac",
        "dev": base_dir / "ASVspoof2019_LA_dev" / "flac",
        "eval": base_dir / "ASVspoof2019_LA_eval" / "flac",
    }

    missing_paths = []
    for split_name, proto_path in protocols.items():
        if not proto_path.exists():
            missing_paths.append(f"Protocol file for '{split_name}': {proto_path}")

    for split_name, flac_dir in flac_dirs.items():
        if not flac_dir.exists():
            missing_paths.append(f"Audio directory for '{split_name}': {flac_dir}")

    if missing_paths:
        logger.error("❌ DATASET VERIFICATION FAILED! Missing expected items:")
        for missing in missing_paths:
            logger.error(f"  - {missing}")
        return False

    # Spot-check files in protocol files
    spot_check_passed = True
    for split_name, proto_path in protocols.items():
        flac_dir = flac_dirs[split_name]
        with open(proto_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
        
        if not lines:
            logger.error(f"❌ Protocol file '{proto_path}' is empty!")
            spot_check_passed = False
            continue

        # Check first 5 referenced flac files
        for line in lines[:5]:
            parts = line.split()
            if len(parts) < 5:
                logger.error(f"❌ Malformed protocol line in '{proto_path}': '{line}'")
                spot_check_passed = False
                break
            filename = parts[1]  # 2nd column
            flac_path = flac_dir / f"{filename}.flac"
            if not flac_path.exists():
                logger.error(f"❌ Referenced audio file not found: '{flac_path}'")
                spot_check_passed = False
                break

    if not spot_check_passed:
        logger.error("❌ Dataset spot-check failed!")
        return False

    logger.info("✅ ASVspoof2019 LA dataset structure successfully verified!")
    return True

def create_mock_dataset(target_dir: str = "./data/LA/LA"):
    """
    Creates a mock ASVspoof2019 LA dataset with synthetic audio files
    for local dry-run training and testing verification.
    """
    import soundfile as sf
    base = Path(target_dir)
    logger.info(f"Creating mock ASVspoof2019 LA dataset at: '{base.resolve()}'")

    protocol_dir = base / "ASVspoof2019_LA_cm_protocols"
    protocol_dir.mkdir(parents=True, exist_ok=True)

    splits = {
        "train": (base / "ASVspoof2019_LA_train" / "flac", protocol_dir / "ASVspoof2019.LA.cm.train.trn.txt"),
        "dev": (base / "ASVspoof2019_LA_dev" / "flac", protocol_dir / "ASVspoof2019.LA.cm.dev.trl.txt"),
        "eval": (base / "ASVspoof2019_LA_eval" / "flac", protocol_dir / "ASVspoof2019.LA.cm.eval.trl.txt"),
    }

    prefix_map = {"train": "T", "dev": "D", "eval": "E"}

    for split_name, (flac_dir, proto_file) in splits.items():
        flac_dir.mkdir(parents=True, exist_ok=True)
        lines = []

        prefix = prefix_map[split_name]
        for i in range(1, 11):  # 10 clips per split
            filename = f"LA_{prefix}_{1000000 + i}"
            label = "bonafide" if i % 2 == 1 else "spoof"
            attack = "-" if label == "bonafide" else f"A{(1 + (i % 6)):02d}"

            line = f"LA_00{i:02d} {filename} - {attack} {label}"
            lines.append(line)

            # Generate synthetic 16kHz sine / noise audio clip (1.5 seconds)
            sr = 16000
            t = np.linspace(0, 1.5, int(sr * 1.5))
            if label == "bonafide":
                # Clean harmonic voice-like signal
                audio = 0.5 * np.sin(2 * np.pi * 220 * t) + 0.25 * np.sin(2 * np.pi * 440 * t)
            else:
                # Modulated noisy synthetic signal
                audio = 0.4 * np.sin(2 * np.pi * 300 * t) + 0.2 * np.random.normal(0, 0.1, len(t))

            audio = audio / np.max(np.abs(audio))
            sf.write(str(flac_dir / f"{filename}.flac"), audio.astype(np.float32), sr)

        with open(proto_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

    logger.info(f"✅ Mock dataset created at '{base.resolve()}'. Set DATASET_PATH={target_dir} to use it.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify ASVspoof2019 LA dataset structure or generate mock data.")
    parser.add_argument("--dataset-path", type=str, default=None, help="Custom dataset path to verify.")
    parser.add_argument("--create-mock", action="store_true", help="Create a local mock dataset for dry-run testing.")
    parser.add_argument("--mock-dir", type=str, default="./data/LA/LA", help="Directory to save mock dataset.")

    args = parser.parse_args()

    if args.create_mock:
        create_mock_dataset(args.mock_dir)
        verify_dataset_structure(args.mock_dir)
    else:
        success = verify_dataset_structure(args.dataset_path)
        if not success:
            sys.exit(1)
