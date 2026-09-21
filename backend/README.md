# CallShadow — AI Voice Deepfake Detector

A full-stack, production-grade application to detect whether a voice recording is human or AI-generated (synthetic speech / voice clone / deepfake). Built with **FastAPI**, **WebSockets**, **PyTorch**, **HuggingFace Transformers**, a plain **HTML/CSS/JS** web client, and a **React Native / Expo** mobile client.

---

## Key Features & Architecture

1. **Self-Trained Wav2Vec2 Classifier**: Fine-tunes `facebook/wav2vec2-base` with a binary classification head on the **ASVspoof2019 LA** benchmark.
2. **Shared Preprocessing Pipeline**: Guarantees identical processing (mono → 16 kHz → peak-norm) across training, REST uploads, and live WebSockets.
3. **Portable Audio Decoding**: Uses `imageio-ffmpeg` to decode `.m4a`, `.webm`, `.mp3`, `.ogg`, and `.flac` without a system FFmpeg install.
4. **Live Microphone WebSockets**: Streams PCM16 audio in 3-second overlapping windows, resampled server-side, with real-time chunk predictions.
5. **Session-Based Auth**: All protected endpoints require a Bearer token from `POST /api/auth/login` or `POST /api/auth/register`. WebSocket connections authenticate via `?token=` query param.
6. **Origin Enforcement**: WebSocket connections are validated against `ALLOWED_ORIGINS`. Native mobile clients (no Origin header) are allowed only with a valid token.
7. **Demo Mode**: If `./trained_model` is absent, the server returns `is_demo_mode: true` and the UI shows a persistent banner.

---

## Directory Structure

```
CallShadow/
├── backend/
│   ├── backend/
│   │   ├── api/
│   │   │   ├── auth_routes.py       # /api/auth/* (register, login, logout, me, password reset)
│   │   │   ├── rest_routes.py       # /api/audio/upload, /api/speaker/enroll|verify, /api/history
│   │   │   └── websocket_routes.py  # WS /api/audio/live
│   │   ├── ml/
│   │   │   ├── trained_adapter.py   # Loads Wav2Vec2 from ./trained_model
│   │   │   └── demo_adapter.py      # Heuristic fallback (pitch, spectral, energy)
│   │   ├── models/
│   │   │   ├── database.py          # SQLAlchemy models (User, SessionToken, AnalysisLog, Voiceprint)
│   │   │   └── schemas.py           # Pydantic v2 schemas
│   │   └── services/
│   │       ├── auth_service.py      # PBKDF2 password hashing, session token management
│   │       └── real_speaker_verifier.py
│   ├── config/
│   │   └── settings.py              # Pydantic BaseSettings — single source for ALLOWED_ORIGINS
│   ├── tests/
│   │   ├── test_auth.py
│   │   ├── test_api.py
│   │   └── test_new_features.py
│   ├── main.py                      # FastAPI app entry point
│   ├── requirements.txt             # Python dependencies (see install note for torch)
│   └── .env.example                 # All configurable environment variables with placeholders
├── web/
│   ├── index.html
│   ├── css/
│   └── js/
├── mobile/                          # React Native / Expo mobile client
│   ├── src/
│   │   ├── services/                # apiClient.ts, liveCallService.ts, uploadService.ts
│   │   └── store/                   # useAuthStore.ts (expo-secure-store token persistence)
│   └── package.json
└── SECURITY.md
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Key variables:

| Variable | Default | Description |
|---|---|---|
| `DEBUG` | `False` | Enable only in development; disables /docs and relaxes origin check |
| `SECRET_KEY` | *(required)* | Random secret for session signing |
| `ALLOWED_ORIGINS` | `http://localhost:8000,...` | Comma-separated list for CORS + WebSocket origin enforcement |
| `DATABASE_URL` | `sqlite:///./voice_detector.db` | SQLAlchemy connection string |
| `TRUST_PROXY_HEADERS` | `False` | Set `True` only when behind a trusted reverse proxy |

---

## Python Dependencies Installation

> **torch and torchaudio must be installed separately** — they require a special CPU build index and conflict with standard PyPI resolution:
>
> ```bash
> pip install torch==2.6.0+cpu torchaudio==2.6.0+cpu \
>     --index-url https://download.pytorch.org/whl/cpu
> ```
>
> Then install production dependencies:
>
> ```bash
> pip install -r backend/requirements.txt
> ```
>
> For running tests and development tools:
>
> ```bash
> pip install -r backend/requirements-dev.txt
> ```

---

## Dataset & Training Workflow

### 1. Dataset Location

The dataset path is set via `DATASET_PATH` environment variable:

- **On Kaggle**: auto-defaults to the mounted ASVspoof2019 LA path.
- **Locally**: `export DATASET_PATH=./data/LA/LA`

### 2. Generate Mock Dataset (local dev)

```bash
python backend/training/download_dataset.py --create-mock
```

### 3. Fine-Tune Wav2Vec2

```bash
python backend/training/train_model.py --epochs 3 --batch-size 8
```

Saves fine-tuned weights to `./backend/trained_model`.

---

## Running the Backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

> **API docs** (`/docs`, `/redoc`) are disabled when `DEBUG=False` (production default).

---

## Running Automated Tests

```bash
cd backend
python -m pytest tests/ -v
```

30 tests: auth flows, REST endpoints, WebSocket origin enforcement, speaker enrollment upsert, Bearer token auth, proxy IP resolution.

---

## Mobile App

```bash
cd mobile
npm install
npx expo start
```

Token is persisted across app restarts using **expo-secure-store** (device keychain). All API requests attach `Authorization: Bearer <token>`. WebSocket connects with `?token=<token>` in the URL (never logged).
