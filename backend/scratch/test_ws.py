import asyncio
import json
import os
import sys
sys.path.insert(0, os.path.abspath('.'))

import numpy as np
from fastapi.testclient import TestClient
from main import app

def test_live_ws():
    client = TestClient(app)
    with client.websocket_connect("/api/audio/live") as ws:
        # Handshake
        ws.send_text(json.dumps({
            "sample_rate": 44100,
            "speaker_id": "",
            "context_data": {}
        }))
        ack = ws.receive_json()
        print("ACK:", ack)

        # Send 3 seconds of audio
        pcm = (np.random.randn(132300) * 1000).astype(np.int16).tobytes()
        ws.send_bytes(pcm)

        chunk = ws.receive_json()
        print("CHUNK:", chunk.get("type"), chunk.get("classification"))

        # Send stop
        ws.send_text(json.dumps({"type": "stop"}))
        summary = ws.receive_json()
        print("SUMMARY received:", summary.get("type"), summary.get("overall_classification"))
        print("TRUST_SCORE:", summary.get("trust_score"))

if __name__ == "__main__":
    test_live_ws()
