import io
import os
import tempfile
import subprocess
import logging
from typing import Tuple
import numpy as np
import soundfile as sf
import librosa

logger = logging.getLogger("VoiceDetector.AudioIngest")

def load_audio_from_bytes(file_bytes: bytes, filename: str = "audio.wav") -> Tuple[np.ndarray, int]:
    """
    Robustly loads audio from raw byte buffer supporting wav, mp3, m4a, flac, ogg, webm.
    Uses imageio-ffmpeg as a portable fallback when soundfile/librosa cannot decode container formats.
    
    Returns:
        (waveform, orig_sample_rate)
    """
    if not file_bytes:
        raise ValueError("Empty audio bytes provided.")

    # Attempt 1: soundfile (in-memory BytesIO)
    try:
        data, sr = sf.read(io.BytesIO(file_bytes), dtype='float32')
        return data, sr
    except Exception as sf_err:
        logger.debug(f"Soundfile in-memory read failed for {filename}: {sf_err}")

    # Attempt 2: Portable direct decoding fallback using bundled imageio-ffmpeg or system ffmpeg binary
    ext = os.path.splitext(filename)[1].lower() or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
        tmp_file.write(file_bytes)
        tmp_path = tmp_file.name

    try:
        try:
            ffmpeg_exe = None
            try:
                import imageio_ffmpeg
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            except ImportError:
                ffmpeg_exe = "ffmpeg"

            cmd = [
                ffmpeg_exe,
                "-nostdin",
                "-threads", "2",
                "-i", tmp_path,
                "-f", "s16le",
                "-ac", "1",
                "-ar", "16000",
                "-acodec", "pcm_s16le",
                "pipe:1"
            ]
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()

            if process.returncode == 0 and stdout:
                pcm16 = np.frombuffer(stdout, dtype=np.int16)
                float32_data = pcm16.astype(np.float32) / 32768.0
                return float32_data, 16000
        except Exception as ffmpeg_err:
            logger.debug(f"Direct FFmpeg decoding notice for {filename}: {ffmpeg_err}")

        # Attempt 3: librosa load fallback
        try:
            data, sr = librosa.load(tmp_path, sr=None, mono=False)
            return data, sr
        except Exception as lib_err:
            logger.debug(f"Librosa load fallback failed for {filename}: {lib_err}")

        raise ValueError(
            f"Unsupported or corrupted audio format for '{filename}'. "
            "Please ensure the file is a valid audio recording (wav, mp3, m4a, flac, ogg, webm)."
        )
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
