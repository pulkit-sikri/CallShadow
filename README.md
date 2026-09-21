# 🛡️ CallShadow — Real-Time Voice Biometrics & Deepfake Defense

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-61DAFB.svg?logo=react)](https://reactnative.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-EE4C2C.svg?logo=pytorch)](https://pytorch.org/)

> **Smart India Hackathon (SIH) MVP Submission** 
> An enterprise-grade, multi-platform platform engineered to detect AI-generated synthetic voice deepfakes, thwart vishing fraud, and verify speaker biometrics in real time during live calls and recorded audio uploads.

---

## 📌 Table of Contents
- [Executive Overview](#-executive-overview)
- [3-Layer Risk Fusion Architecture](#-3-layer-risk-fusion-architecture)
- [Monorepo Structure](#-monorepo-structure)
- [System Requirements](#-system-requirements)
- [Quick Start Guide](#-quick-start-guide)
 - [1. Backend & ML Engine](#1-backend--ml-engine)
 - [2. Web Dashboard](#2-web-dashboard)
 - [3. Mobile Application (React Native)](#3-mobile-application-react-native)
- [Core Features](#-core-features)
- [Tech Stack](#-tech-stack)
- [API Reference Summary](#-api-reference-summary)
- [Documentation & Reports](#-documentation--reports)
- [License](#-license)

---

## 🎯 Executive Overview

With modern diffusion and neural voice cloning tools (e.g., ElevenLabs, OpenAI Voice, VALL-E), malicious actors can replicate a person's voice from seconds of sample audio. CallShadow solves this vulnerability by providing:
1. **Live Call Interception & Push-to-Talk Verification**: Streaming audio chunks over low-latency WebSockets with sub-second inference.
2. **Forensic Audio Upload & Spectral Breakdown**: Multi-format audio decoding (MP3, WAV, M4A, AAC, FLAC, WebM) with confidence intervals.
3. **1-to-1 Speaker Biometric Enrollment**: Cosine distance verification against enrolled voice profiles using ECAPA-TDNN embeddings.
4. **Context-Aware Fraud Risk Engine**: Combining deepfake confidence, speaker matching, caller urgency, and transaction volume into a unified **Trust Score (0–100)**.
5. **Instant PDF Audit Certificate**: Tamper-evident, cryptographically signed forensic audit reports.

---

## 🧠 3-Layer Risk Fusion Architecture

CallShadow calculates a multi-factor **Trust Score** across three dedicated analytical layers:

`
 [ Ingested Audio / Stream ]
 │
 ┌───────────────────────────────┼───────────────────────────────┐
 ▼ ▼ ▼
 ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 │ LAYER 1 │ │ LAYER 2 │ │ LAYER 3 │
 │ Voice Clone │ │ Speaker ID │ │ Contextual │
 │ (Wav2Vec2) │ │ (ECAPA-TDNN) │ │ Risk Engine │
 └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
 │ [40% Weight] │ [30% Weight] │ [30% Weight]
 └───────────────────────┬───────┴───────────────────────────────┘
 ▼
 ┌───────────────────────────┐
 │ Unified Risk Fusion │
 │ Trust Score (0-100) │
 └─────────────┬─────────────┘
 ▼
 [ Action Verdict & PDF Report ]
`

| Layer | Component | Model / Engine | Weight | Description |
|---|---|---|---|---|
| **Layer 1** | **Deepfake Detection** | Fine-Tuned wav2vec2-base | **40%** | Detects synthetic artifacts, phase anomalies, and unnatural spectral signatures. |
| **Layer 2** | **Speaker Verification** | ECAPA-TDNN (SpeechBrain) | **30%** | Extracts 192-dim x-vectors to verify speaker identity against registered voiceprints. |
| **Layer 3** | **Context & Metadata** | Heuristic Rules & Scoring | **30%** | Evaluates financial transaction amounts, urgency markers, and caller metadata. |

---

## 📂 Monorepo Structure

` ext
CallShadow/
├── backend/ # Python FastAPI Backend & AI/ML Engine
│ ├── backend/ # Core API routes, audio pipelines, and services
│ ├── config/ # Settings & environmental parameters
│ ├── data/ # Dataset protocols & mock generators
│ ├── pretrained_ecapa/ # ECAPA-TDNN speaker embedding models
│ ├── tests/ # Automated pytest suites (API, Audio, ML)
│ ├── trained_model/ # Fine-tuned Wav2Vec2 weights & configs
│ ├── training/ # ASVspoof 2019 fine-tuning pipelines
│ ├── main.py # FastAPI server application entrypoint
│ ├── requirements.txt # Python dependencies
│ └── .env.example # Backend environment variables template
│
├── web/ # High-Performance Web Dashboard
│ ├── assets/ # Branding, icons, and illustrations
│ ├── js/ # Canvas visualizers, WebSocket clients, audio processors
│ ├── index.html # Responsive Glassmorphism dashboard UI
│ ├── app.js # Web application controller
│ ├── styles.css # Custom CSS design system
│ └── .env.example # Web frontend environment template
│
├── mobile/ # React Native (Expo) Mobile Application
│ ├── src/ # App components, navigation, stores, and services
│ ├── assets/ # Splash screens and app icons
│ ├── App.tsx # Root mobile application component
│ ├── package.json # Node dependencies & scripts
│ ├── tsconfig.json # TypeScript configuration
│ └── .env.example # Mobile environment configuration
│
├── docs/ # Technical documentation & reports
│ └── project_report.md # Official SIH detailed project report
│
├── .gitignore # Root gitignore excluding caches, weights, and node_modules
├── LICENSE # MIT Open-Source License
└── README.md # Master repository guide
`

---

## 💻 System Requirements

- **Python**: 3.10 or 3.11
- **Node.js**: 18.x or 20.x with 
pm or yarn
- **Mobile Runtime**: Expo Go app on physical Android/iOS device or an Android Studio Emulator
- **Operating System**: Windows 10/11, macOS, or Linux

---

## ⚡ Quick Start Guide

### 1. Backend & ML Engine

`ash
# 1. Navigate to the backend folder
cd backend

# 2. Create and activate a Python virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy environment configuration
cp .env.example .env

# 5. Start the FastAPI server
python main.py
`
* The backend API server will start on http://localhost:8000.
* Interactive Swagger Docs: http://localhost:8000/docs (available when DEBUG=True)
* Health Check: http://localhost:8000/api/health

---

### 2. Web Dashboard

The web dashboard is statically hosted and configured to connect seamlessly to the backend:

- **Option A (Static Open)**: Open web/index.html in any modern web browser or use VSCode Live Server.
- **Option B (Served via Backend)**: When running python main.py, the backend automatically serves the frontend at http://localhost:8000/.

---

### 3. Mobile Application (React Native)

`ash
# 1. Navigate to the mobile folder
cd mobile

# 2. Install Node dependencies
npm install

# 3. Copy environment configuration
cp .env.example .env

# 4. Launch Expo Development Server
npm start
`
* Press **** to open in Android Emulator, or scan the QR code using the **Expo Go** app on your physical smartphone.
* **Auto-Discovery**: The mobile app dynamically resolves your host IP over Wi-Fi, allowing instant live WebSocket streaming from physical devices without hardcoded URLs.

---

## 🚀 Core Features

- **Real-Time WebSocket Audio Ingestion**: 16kHz PCM streaming with 3.0s sliding windows and 1.0s overlap.
- **Push-to-Talk Gated Audio**: Seamless mobile packet transmission pause/resume for natural conversations.
- **Forensic PDF Generator**: Generates verifiable PDF certificates with timestamps, chunk waveforms, trust score breakdown, and cryptographic checksums.
- **Multi-Format In-Process Decoding**: Supports .wav, .mp3, .m4a, .flac, .ogg, and .webm with automatic fallback to imageio-ffmpeg.
- **Zero-Dependency Demo Mode**: Automatic graceful degradation with heuristic acoustic analysis (pitch variance, spectral centroid) if full model weights are not loaded.

---

## 🛠️ Tech Stack

### Artificial Intelligence & Audio Processing
- **PyTorch** & **HuggingFace Transformers** (wav2vec2-base)
- **SpeechBrain** (ECAPA-TDNN 192-dim x-vector speaker biometrics)
- **Librosa**, **SoundFile**, **imageio-ffmpeg** (16kHz resampling, normalisation)

### Backend & Microservices
- **FastAPI** & **Uvicorn** (Asynchronous ASGI Server)
- **WebSockets** (Full-duplex real-time packet transport)
- **SQLAlchemy** & **SQLite / PostgreSQL** (Audit persistence)
- **ReportLab** (Dynamic PDF audit certificate engine)

### Mobile & Frontend
- **React Native** & **Expo SDK 57** (Cross-platform mobile)
- **TypeScript** & **Zustand** (Predictable reactive state management)
- **HTML5 WebAudio API & Canvas** (Real-time frequency & waveform rendering)

---

## 📡 API Reference Summary

| Endpoint | Method | Protocol | Description |
|---|---|---|---|
| /api/health | GET | HTTP | System diagnostics, GPU status, and model readiness |
| /api/auth/register | POST | HTTP | User registration with PBKDF2 password hashing |
| /api/auth/login | POST | HTTP | JWT authentication token issue |
| /api/audio/upload | POST | HTTP Multipart | Audio file deepfake analysis & scoring |
| /api/audio/live | GET | WebSocket | Real-time duplex audio chunk streaming & verdict |
| /api/speaker/enroll | POST | HTTP Multipart | Registers 192-dim reference speaker biometric vector |
| /api/reports/audit-pdf | POST | HTTP | Generates downloadable forensic PDF certificate |

---

## 📚 Documentation & Reports

Detailed technical documentation, training methodologies, evaluation metrics (EER, ROC-AUC), and architectural decisions are located in:
- [📖 Detailed Project Report (SIH Submission)](docs/project_report.md)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
