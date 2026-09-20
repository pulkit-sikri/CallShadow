// Audio Visualizer & Recording Engine
// Handles WebAudio Canvas rendering, microphone recording, audio levels, and preview playback.

class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.mediaStream = null;
        this.analyser = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordedBlob = null;
        this.recordedAudioUrl = null;
        this.animationId = null;
        this.isRecording = false;
        this.recordingStartTime = 0;
        this.timerInterval = null;
        this.pcmDataCallback = null;
        // AudioWorklet replaces deprecated ScriptProcessorNode
        this.workletNode = null;
    }

    // Initialize WebAudio context
    initAudioContext() {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    // Start Live Microphone Recording
    async startRecording(canvasId, vuMeterId, timerId, statusCallback, onPcmChunk) {
        this.recordedChunks = [];
        this.recordedBlob = null;
        if (this.recordedAudioUrl) {
            URL.revokeObjectURL(this.recordedAudioUrl);
            this.recordedAudioUrl = null;
        }

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone access is not supported in this browser.");
            }

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.initAudioContext();
            const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.8;
            source.connect(this.analyser);

            // AudioWorklet PCM capture for WebSocket streaming (replaces deprecated ScriptProcessorNode)
            // Runs on a dedicated audio thread — does NOT block the UI even during heavy canvas animation.
            if (onPcmChunk && typeof onPcmChunk === 'function') {
                try {
                    await this.audioCtx.audioWorklet.addModule('/js/pcm-processor.js');
                    this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-processor');
                    this.workletNode.port.onmessage = (e) => {
                        if (!this.isRecording) return;
                        // Convert Float32Array → Int16Array (PCM16)
                        const float32 = new Float32Array(e.data);
                        const pcm16   = new Int16Array(float32.length);
                        for (let i = 0; i < float32.length; i++) {
                            const s = Math.max(-1, Math.min(1, float32[i]));
                            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        }
                        onPcmChunk(pcm16.buffer);
                    };
                    source.connect(this.workletNode);
                    // Worklet does not need to connect to destination (no audio output needed)
                } catch (workletErr) {
                    console.warn('[AudioEngine] AudioWorklet unavailable, falling back to ScriptProcessorNode:', workletErr);
                    // Fallback for browsers without AudioWorklet support
                    const bufferSize = 4096;
                    const scriptProc = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);
                    scriptProc.onaudioprocess = (e) => {
                        if (!this.isRecording) return;
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcm16 = new Int16Array(inputData.length);
                        for (let i = 0; i < inputData.length; i++) {
                            const s = Math.max(-1, Math.min(1, inputData[i]));
                            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        }
                        onPcmChunk(pcm16.buffer);
                    };
                    source.connect(scriptProc);
                    scriptProc.connect(this.audioCtx.destination);
                    this.workletNode = scriptProc; // Store for cleanup
                }
            }

            // MediaRecorder for capturing file for REST analysis / preview playback
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
                ? 'audio/webm' 
                : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg');

            this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(250); // Slice every 250ms
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Start timer
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            if (timerId) {
                const timerEl = document.getElementById(timerId);
                if (timerEl) {
                    timerEl.textContent = "00:00";
                    timerEl.classList.remove('hidden');
                }
                this.timerInterval = setInterval(() => {
                    if (!this.isRecording) {
                        if (this.timerInterval) {
                            clearInterval(this.timerInterval);
                            this.timerInterval = null;
                        }
                        return;
                    }
                    const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
                    const secs = String(elapsed % 60).padStart(2, '0');
                    if (timerEl) timerEl.textContent = `${mins}:${secs}`;
                }, 500);
            }

            // Start Canvas Waveform Visualizer
            this.drawLiveWaveform(canvasId, vuMeterId);

            if (statusCallback) statusCallback({ status: "recording" });
            return { success: true, sampleRate: this.audioCtx.sampleRate };
        } catch (err) {
            console.error("Microphone recording error:", err);
            this.stopRecording();
            let userMessage = "Could not access microphone.";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                userMessage = "Microphone permission was denied. Please allow microphone access in your browser settings.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                userMessage = "No microphone input device was found on this computer.";
            } else if (err.message) {
                userMessage = err.message;
            }
            if (statusCallback) statusCallback({ status: "error", error: userMessage });
            throw new Error(userMessage);
        }
    }

    // Stop and clear the timer immediately
    stopTimer(timerId) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Stop Live Recording
    stopRecording() {
        return new Promise((resolve) => {
            this.isRecording = false;
            this.stopTimer();

            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }

            if (this.workletNode) {
                try { this.workletNode.disconnect(); } catch (_) {}
                if (this.workletNode.port) {
                    this.workletNode.port.onmessage = null;
                }
                this.workletNode = null;
            }

            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }

            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.onstop = () => {
                    const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
                    this.recordedBlob = new Blob(this.recordedChunks, { type: mimeType });
                    this.recordedAudioUrl = URL.createObjectURL(this.recordedBlob);
                    
                    // Create a standard File object named recording.wav/.webm
                    const ext = mimeType.includes('mp4') ? 'm4a' : (mimeType.includes('ogg') ? 'ogg' : 'webm');
                    const recordedFile = new File([this.recordedBlob], `live_recording_${Date.now()}.${ext}`, { type: mimeType });

                    resolve({
                        blob: this.recordedBlob,
                        file: recordedFile,
                        url: this.recordedAudioUrl,
                        durationSec: ((Date.now() - this.recordingStartTime) / 1000).toFixed(1)
                    });
                };
                this.mediaRecorder.stop();
            } else {
                resolve({ blob: null, file: null, url: null, durationSec: 0 });
            }
        });
    }

    // Live HTML5 Canvas Waveform and Audio Level Animation
    drawLiveWaveform(canvasId, vuMeterId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !this.analyser) return;

        const ctx = canvas.getContext('2d');
        const bufferLength = this.analyser.frequencyBinCount;
        const timeData = new Uint8Array(bufferLength);
        const freqData = new Uint8Array(bufferLength);
        const vuMeter = vuMeterId ? document.getElementById(vuMeterId) : null;

        const render = () => {
            if (!this.isRecording || !this.analyser) {
                return;
            }
            this.animationId = requestAnimationFrame(render);

            this.analyser.getByteTimeDomainData(timeData);
            this.analyser.getByteFrequencyData(freqData);

            // Compute average RMS level for VU meter
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                const val = (timeData[i] - 128) / 128;
                sum += val * val;
            }
            const rms = Math.sqrt(sum / bufferLength);
            const levelPct = Math.min(100, Math.round(rms * 280));
            if (vuMeter) {
                vuMeter.style.width = `${levelPct}%`;
                if (levelPct > 75) {
                    vuMeter.style.backgroundColor = '#ef4444';
                } else if (levelPct > 40) {
                    vuMeter.style.backgroundColor = '#f97316';
                } else {
                    vuMeter.style.backgroundColor = '#10b981';
                }
            }

            // Draw Futuristic Cybersecurity Soundwave on Canvas
            const width = canvas.width;
            const height = canvas.height;

            ctx.fillStyle = 'rgba(8, 11, 17, 0.4)';
            ctx.fillRect(0, 0, width, height);

            // Draw center reference line
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();

            // Glow effect
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#f97316';

            // Draw Orange Holographic Waveform
            ctx.lineWidth = 2.5;
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#ea580c');
            gradient.addColorStop(0.5, '#fb923c');
            gradient.addColorStop(1, '#ea580c');
            ctx.strokeStyle = gradient;

            ctx.beginPath();
            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = timeData[i] / 128.0;
                const y = (v * height) / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }

            ctx.lineTo(width, height / 2);
            ctx.stroke();

            // Reset shadow
            ctx.shadowBlur = 0;
        };

        render();
    }

    // Static Waveform Visualizer for Uploaded/Recorded Files
    async renderStaticWaveform(canvasId, audioBlobOrUrl) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#080b11';
        ctx.fillRect(0, 0, width, height);

        try {
            this.initAudioContext();
            let arrayBuffer;
            if (audioBlobOrUrl instanceof Blob) {
                arrayBuffer = await audioBlobOrUrl.arrayBuffer();
            } else if (typeof audioBlobOrUrl === 'string') {
                const res = await fetch(audioBlobOrUrl);
                arrayBuffer = await res.arrayBuffer();
            }

            if (!arrayBuffer) return;
            const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);
            const samples = 140; // Number of bars
            const blockSize = Math.floor(rawData.length / samples);
            const filteredData = [];

            for (let i = 0; i < samples; i++) {
                let blockStart = blockSize * i;
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[blockStart + j] || 0);
                }
                filteredData.push(sum / blockSize);
            }

            const maxVal = Math.max(...filteredData) || 1;
            const barWidth = (width / samples) - 1.5;

            filteredData.forEach((val, i) => {
                const barHeight = Math.max(4, (val / maxVal) * (height - 16));
                const x = i * (barWidth + 1.5);
                const y = (height - barHeight) / 2;

                const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
                grad.addColorStop(0, '#fb923c');
                grad.addColorStop(1, '#ea580c');

                ctx.fillStyle = grad;
                ctx.fillRect(x, y, barWidth, barHeight);
            });
        } catch (e) {
            // Draw stylized fallback waveform if decoding fails (e.g. mock audio)
            this.drawDecorativeWaveform(canvasId);
        }
    }

    // Decorative Animated Waveform for Hero/Headers
    drawDecorativeWaveform(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = 'rgba(8, 11, 17, 0.6)';
        ctx.fillRect(0, 0, width, height);

        const bars = 64;
        const barWidth = (width / bars) - 2;

        for (let i = 0; i < bars; i++) {
            const norm = Math.sin((i / bars) * Math.PI) * Math.sin(i * 0.4 + Date.now() * 0.002);
            const barHeight = Math.max(4, Math.abs(norm) * (height * 0.75));
            const x = i * (barWidth + 2);
            const y = (height - barHeight) / 2;

            ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#fb923c';
            ctx.fillRect(x, y, barWidth, barHeight);
        }
    }
    // Stop live waveform visualizer (called by app.js during live recording stop)
    stopLiveVisualizer() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // Clear canvas to idle state
        const canvas = document.getElementById('live-waveform-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#080b11';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Start live waveform visualizer (thin wrapper used by app.js)
    startLiveVisualizer(stream, canvasId) {
        this.mediaStream = stream || this.mediaStream;
        this.drawLiveWaveform(canvasId, null);
    }

    // Draw idle state with dark background and centerline
    drawIdleWaveform(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.fillStyle = '#080b11';
        ctx.fillRect(0, 0, width, height);

        // Center line
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Subtle waiting label
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for audio stream...', width / 2, height / 2 - 8);
    }
}

window.audioEngine = new AudioEngine();
