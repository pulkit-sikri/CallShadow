import sys
sys.path.insert(0, '.')
import time
import numpy as np
import scipy.signal

def fast_extract_acoustic_features(waveform_16k: np.ndarray, sample_rate: int = 16000):
    features = {
        "pitch_std": 0.0,
        "pitch_mean": 0.0,
        "spectral_centroid_std_ratio": 0.0,
        "energy_flatness": 0.0,
        "zero_crossing_rate": 0.0,
        "spectral_flux": 0.0
    }

    if len(waveform_16k) < sample_rate * 0.1:
        return features

    # Fast STFT via scipy.signal.stft
    f, t, Zxx = scipy.signal.stft(waveform_16k, fs=sample_rate, nperseg=512, noverlap=256)
    mag = np.abs(Zxx) + 1e-10
    power = mag ** 2

    # 1. Fast Pitch Extraction via Autocorrelation on 30ms frames
    frame_len = int(sample_rate * 0.03)  # 30ms
    hop = int(sample_rate * 0.015)       # 15ms
    min_lag = int(sample_rate / 500)     # 500 Hz max pitch
    max_lag = int(sample_rate / 50)      # 50 Hz min pitch

    pitches = []
    for i in range(0, len(waveform_16k) - frame_len, hop):
        frame = waveform_16k[i : i + frame_len]
        if np.max(np.abs(frame)) < 0.01:
            continue
        corr = scipy.signal.correlate(frame, frame, mode='full')
        corr = corr[len(frame)-1:]
        if len(corr) > max_lag:
            peak_lag = min_lag + np.argmax(corr[min_lag:max_lag])
            if corr[peak_lag] > 0.3 * corr[0]:
                f0 = sample_rate / peak_lag
                pitches.append(f0)

    if len(pitches) > 0:
        features["pitch_std"] = float(np.std(pitches))
        features["pitch_mean"] = float(np.mean(pitches))

    # 2. Spectral Centroid
    freqs = f[:, np.newaxis]
    centroid = np.sum(freqs * mag, axis=0) / np.sum(mag, axis=0)
    mean_sc = np.mean(centroid)
    std_sc = np.std(centroid)
    if mean_sc > 1e-5:
        features["spectral_centroid_std_ratio"] = float(std_sc / mean_sc)

    # 3. Energy / Spectral Flatness (geometric mean / arithmetic mean)
    log_power = np.log(power)
    geom_mean = np.exp(np.mean(log_power, axis=0))
    arith_mean = np.mean(power, axis=0)
    flatness = geom_mean / (arith_mean + 1e-10)
    features["energy_flatness"] = float(np.mean(flatness))

    # 4. Zero Crossing Rate
    zcr = np.mean(np.abs(np.diff(np.sign(waveform_16k)))) / 2.0
    features["zero_crossing_rate"] = float(zcr)

    # 5. Spectral Flux
    diff = np.diff(mag, axis=1)
    flux = np.sqrt(np.sum(diff ** 2, axis=0))
    features["spectral_flux"] = float(np.mean(flux)) if len(flux) > 0 else 0.0

    return features

dummy_wav = (0.5 * np.sin(2 * np.pi * 440 * np.linspace(0, 3, 48000))).astype(np.float32)

t0 = time.time()
feat = fast_extract_acoustic_features(dummy_wav, 16000)
t1 = time.time()
print(f"fast_extract_acoustic_features took: {(t1 - t0)*1000:.2f}ms")
print("Features:", feat)
