# AI Voice Deepfake Detector

A full-stack, production-grade web application to detect whether a voice recording is human or AI-generated (synthetic speech/voice clone/deepfake). Built with **FastAPI**, **WebSockets**, **PyTorch**, **HuggingFace Transformers**, and plain **HTML/CSS/JS** with real-time WebAudio canvas rendering.

---

## Key Features & Architecture

1. **Self-Trained Wav2Vec2 Classifier**: Fine-tunes a pretrained speech backbone (`facebook/wav2vec2-base` or `wav2vec2-large-xlsr-53`) with a binary classification head on the official **ASVspoof2019 Logical Access (LA)** benchmark.
2. **Shared Preprocessing Pipeline (`backend/audio/preprocess.py`)**: Guarantees identical processing (mono conversion $\to$ 16kHz resampling $\to$ peak amplitude normalization) across training, REST file uploads, and live WebSockets.
3. **Portable Audio Decoding (`backend/audio/ingest.py`)**: Uses `imageio-ffmpeg` as an in-process fallback to decode `.m4a`, `.webm`, `.mp3`, `.ogg`, and `.flac` without requiring a system FFmpeg installation.
4. **Live Microphone WebSockets**: Reads actual browser `AudioContext.sampleRate` during the connection handshake, streams PCM16 audio in 3-second overlapping windows, resamples backend-side, and emits real-time chunk predictions + session summary.
5. **Strict Demo Mode Visibility**: If `./trained_model` is not found, logs a loud unmissable warning, returns `is_demo_mode: true` in `/api/health`, and displays a persistent sticky banner in the UI.

---

## Directory Structure

```
SIH_MVP/
├── backend/
│   ├── audio/
│   │   ├── ingest.py          # Multi-format decoder with imageio-ffmpeg fallback
│   │   └── preprocess.py      # Shared preprocessing function (mono, 16k resample, peak norm)
│   ├── ml/
│   │   ├── base.py            # Abstract VoiceDetector interface & ChunkPrediction dataclass
│   │   ├── trained_adapter.py # Loads Wav2Vec2 model from ./trained_model
│   │   ├── demo_adapter.py    # Heuristic fallback adapter (pitch variance, spectral centroid, energy flatness)
│   │   ├── features.py       # Acoustic feature extraction engine
│   │   ├── aggregator.py      # Combines chunk predictions & calculates statistics
│   │   └── factory.py         # Factory with loud warning logging on fallback to DemoModeAdapter
│   ├── api/
│   │   ├── rest_routes.py     # /api/health and /api/audio/upload endpoints
│   │   └── websocket_routes.py# /api/audio/live WebSocket endpoint
│   ├── services/
│   │   └── analysis_service.py# High-level orchestration for file and stream analysis
│   └── models/
│       ├── schemas.py         # Pydantic v2 validation models
│       └── database.py        # SQLAlchemy SQLite audit logger
├── training/
│   ├── download_dataset.py    # Path/structure verification script & mock dataset generator
│   ├── train_model.py         # PyTorch/Transformers Trainer fine-tuning script
│   └── eval_report.md         # Evaluation report (EER, AUC, Accuracy, Confusion Matrix)
├── frontend/
│   ├── index.html             # Two-tab UI with Demo Mode Banner & Results display
│   ├── styles.css             # Glassmorphism dark mode aesthetic & responsive CSS
│   └── app.js                 # Plain JS for drag-drop upload, WebAudio mic, WebSocket & Canvas chart
├── config/
│   └── settings.py            # App settings (Pydantic BaseSettings)
├── tests/
│   ├── test_audio_processing.py # Regression test for shared pipeline & decoding (m4a/mp3/wav/webm)
│   ├── test_ml_pipeline.py    # Model loading, probability sum checks, and fallback warning test
│   └── test_api.py            # Upload, health, and WebSocket end-to-end tests
├── main.py                    # FastAPI app entry point & static mount
├── requirements.txt           # Python dependencies
└── README.md                  # Comprehensive setup, dataset verification, training, & execution guide
```

---

## Environment & Dependencies Installation

1. Ensure Python 3.11+ is installed.
2. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

---

## Dataset & Training Workflow

### 1. Dataset Location Resolution
The dataset path is read from environment variable `DATASET_PATH` via `config/settings.py`:
- **On Kaggle**: Defaults automatically to the mounted read-only path:
  ```
  /kaggle/input/datasets/awsaf49/asvpoof-2019-dataset/LA/LA/
  ```
- **Locally**: Set `DATASET_PATH=./data/LA/LA` or pass `--data-dir ./data/LA/LA` to run verification and training on mock data.

### 2. Verify Dataset Paths
Run the dataset structure verification script:
```bash
python training/download_dataset.py
```
*(On local machines without Kaggle data, run `python training/download_dataset.py --create-mock` to generate local test data at `./data/LA/LA`)*.

### 3. Fine-Tune Wav2Vec2 Model
Run `training/train_model.py` to train the classifier and generate `./trained_model`:
```bash
python training/train_model.py --epochs 3 --batch-size 8
```
This script:
- Verifies protocol files and `.flac` audio paths.
- Fine-tunes Wav2Vec2 with frozen feature-extractor layers.
- Checkpoints best model by validation **Equal Error Rate (EER)**.
- Saves fine-tuned weights to `./trained_model`.
- Generates `training/eval_report.md` with EER, AUC-ROC, accuracy, and confusion matrix.

---

## Launching the Web Application

Start the FastAPI application:
```bash
python main.py
```
Or via Uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Open your browser to: **`http://localhost:8000`**

- **Upload File Tab**: Drag and drop audio files (`.wav`, `.mp3`, `.m4a`, `.flac`, `.ogg`, `.webm`) for analysis.
- **Live Microphone Tab**: Click "Start Live Recording" for real-time WebSocket streaming with canvas waveform visualizer.

---

## Running Automated Tests

Run all unit and regression tests with `pytest`:
```bash
pytest tests/ -v
```
Tests cover:
- `test_audio_processing.py`: Numerical preprocessing consistency (upload vs streaming) and multi-format decoding.
- `test_ml_pipeline.py`: Trained model adapter loading, probability normalization, and fallback loud warning output.
- `test_api.py`: `/api/health`, `/api/audio/upload`, and `WS /api/audio/live` end-to-end WebSocket roundtrip.
