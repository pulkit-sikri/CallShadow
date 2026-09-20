// Mock & Demonstration Datasets
// Clearly identified for interactive demo scenarios, presentation testing, and graceful fallback.

const MOCK_DATA = {
    // 3 Interactive Showcase Scenarios (3-Model Architecture: 40% AI Generated, 30% Identity Matching, 30% Context Safe)
    scenarios: {
        genuine: {
            id: "DEMO-GEN-001",
            scenarioName: "Genuine Human Voice",
            scenarioDescription: "Legitimate user with matching enrolled biometrics and routine context parameters.",
            inputType: "Live Audio Recording",
            fileName: "mic_session_genuine_01.wav",
            timestamp: new Date().toISOString(),
            duration: "6.4s",
            isDemo: true,
            trustScore: {
                overall: 94,
                formula: "Final Trust Score = (0.40 × AI Authenticity) + (0.30 × Identity Match) + (0.30 × Context Safe)",
                status: "TRUSTED_LOW_RISK",
                badgeClass: "badge-trusted",
                summary: "Verified genuine speech with confirmed speaker identity and consistent contextual behavior.",
                recommendedAction: "ALLOW_TRANSACTION",
                factors: [
                    { name: "1. Voice Authenticity (Real / Synthetic)", score: 96, weight: "+38 / 40 pts", weightPct: "40% Weight", status: "REAL_HUMAN", isPassed: true, checkLabel: "Real Voice Verified", description: "Natural genuine human vocal tract acoustics" },
                    { name: "2. Claimed Identity Match", score: 94, weight: "+28 / 30 pts", weightPct: "30% Weight", status: "MATCHED", isPassed: true, checkLabel: "Identity Matched", description: "Biometric voiceprint matches enrolled profile VX-4819" },
                    { name: "3. Context Safety", score: 92, weight: "+28 / 30 pts", weightPct: "30% Weight", status: "SAFE", isPassed: true, checkLabel: "Context Safe", description: "Session parameters match typical user behavior and baseline" }
                ],
                checklist: [
                    { text: "Voice Authenticity: Natural genuine human speech verified (Real Voice)", safe: true },
                    { text: "Claimed Identity: Speaker biometrics align with enrolled voiceprint VX-4819", safe: true },
                    { text: "Context Safety: Contextual transaction parameters within safe bounds", safe: true }
                ]
            },
            probabilities: {
                aiProbability: 0.04,
                humanProbability: 0.96,
                meanAi: 0.038,
                medianAi: 0.032,
                maxAi: 0.061,
                confidence: 0.985
            },
            explainability: {
                pitchMonotonicity: false,
                spectralAnomaly: false,
                energyFlatnessAnomaly: false,
                details: "Acoustic envelope shows organic breath patterns, high spectral harmonic richness, and natural fundamental frequency perturbation (jitter/shimmer within human biological limits)."
            },
            chunks: [
                { chunk_index: 0, start_time: 0.0, end_time: 2.0, ai_probability: 0.03, classification: "Human Genuine", confidence: 0.99 },
                { chunk_index: 1, start_time: 2.0, end_time: 4.0, ai_probability: 0.04, classification: "Human Genuine", confidence: 0.98 },
                { chunk_index: 2, start_time: 4.0, end_time: 6.4, ai_probability: 0.05, classification: "Human Genuine", confidence: 0.98 }
            ]
        },

        deepfake: {
            id: "DEMO-SYN-002",
            scenarioName: "AI-Generated Deepfake Voice",
            scenarioDescription: "Synthetic neural text-to-speech audio attempting unauthorized authorization.",
            inputType: "Uploaded Audio",
            fileName: "elevenlabs_clone_sample.mp3",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            duration: "8.2s",
            isDemo: true,
            trustScore: {
                overall: 23,
                formula: "Final Trust Score = (0.40 × AI Authenticity) + (0.30 × Identity Match) + (0.30 × Context Safe)",
                status: "CRITICAL_AI_BLOCK",
                badgeClass: "badge-high-risk",
                summary: "Synthetic neural vocoder markers and artificial spectral flatness detected across multiple time windows.",
                recommendedAction: "IMMEDIATE_BLOCK_ALERT",
                factors: [
                    { name: "1. Voice Authenticity (Real / Synthetic)", score: 6, weight: "+2 / 40 pts", weightPct: "40% Weight", status: "SYNTHETIC_AI", isPassed: false, checkLabel: "Synthetic AI Detected", description: "Unnatural phase continuity and robotic vocoder artifacts detected" },
                    { name: "2. Claimed Identity Match", score: 35, weight: "+10 / 30 pts", weightPct: "30% Weight", status: "MISMATCH", isPassed: false, checkLabel: "Identity Mismatch", description: "Acoustic clone lacks biological vocal tract depth and profile alignment" },
                    { name: "3. Context Safety", score: 40, weight: "+12 / 30 pts", weightPct: "30% Weight", status: "RISKY", isPassed: false, checkLabel: "Context Risk Anomaly", description: "Unrecognized request channel and anomalous security vector" }
                ],
                checklist: [
                    { text: "Voice Authenticity: Neural vocoder synthesis signature detected (Synthetic AI)", safe: false },
                    { text: "Claimed Identity: Voiceprint rejected: artificial voice clone does not match profile", safe: false },
                    { text: "Context Safety: High risk manipulation vector exceeds security threshold", safe: false }
                ]
            },
            probabilities: {
                aiProbability: 0.94,
                humanProbability: 0.06,
                meanAi: 0.925,
                medianAi: 0.941,
                maxAi: 0.987,
                confidence: 0.972
            },
            explainability: {
                pitchMonotonicity: true,
                spectralAnomaly: true,
                energyFlatnessAnomaly: true,
                details: "Elevated spectral flatness detected with monotonic fundamental frequency contours characteristic of autoregressive diffusion neural vocoders (e.g. ElevenLabs / Bark architecture)."
            },
            chunks: [
                { chunk_index: 0, start_time: 0.0, end_time: 2.0, ai_probability: 0.91, classification: "AI Generated", confidence: 0.96 },
                { chunk_index: 1, start_time: 2.0, end_time: 4.0, ai_probability: 0.96, classification: "AI Generated", confidence: 0.99 },
                { chunk_index: 2, start_time: 4.0, end_time: 6.0, ai_probability: 0.95, classification: "AI Generated", confidence: 0.98 },
                { chunk_index: 3, start_time: 6.0, end_time: 8.2, ai_probability: 0.93, classification: "AI Generated", confidence: 0.96 }
            ]
        },

        suspiciousContext: {
            id: "DEMO-CTX-003",
            scenarioName: "Authentic Voice + Suspicious Context",
            scenarioDescription: "Voice acoustics are genuinely human, but high-risk contextual parameters trigger secondary verification.",
            inputType: "Uploaded Audio",
            fileName: "wire_transfer_auth.wav",
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            duration: "5.1s",
            isDemo: true,
            trustScore: {
                overall: 71,
                formula: "Final Trust Score = (0.40 × AI Authenticity) + (0.30 × Identity Match) + (0.30 × Context Safe)",
                status: "CONTEXT_RISK_STEP_UP",
                badgeClass: "badge-suspicious",
                summary: "Voice authenticity is high (94%) and identity matches, but high-value transaction risk requires step-up authentication.",
                recommendedAction: "STEP_UP_MFA_REQUIRED",
                factors: [
                    { name: "1. Voice Authenticity (Real / Synthetic)", score: 94, weight: "+38 / 40 pts", weightPct: "40% Weight", status: "REAL_HUMAN", isPassed: true, checkLabel: "Real Voice Verified", description: "Human organic vocal characteristics confirmed" },
                    { name: "2. Claimed Identity Match", score: 92, weight: "+28 / 30 pts", weightPct: "30% Weight", status: "MATCHED", isPassed: true, checkLabel: "Identity Matched", description: "Speaker biometrics match profile VX-1092" },
                    { name: "3. Context Safety", score: 20, weight: "+6 / 30 pts", weightPct: "30% Weight", status: "RISKY", isPassed: false, checkLabel: "Context Risk Anomaly", description: "High-value $45,000 transfer deviates from user baseline" }
                ],
                checklist: [
                    { text: "Voice Authenticity: Genuine biological human speech verified (Real Voice)", safe: true },
                    { text: "Claimed Identity: Speaker identity aligns with enrolled user profile VX-1092", safe: true },
                    { text: "Context Safety: Context Anomaly: High-risk $45,000 transaction deviates from baseline", safe: false }
                ]
            },
            probabilities: {
                aiProbability: 0.06,
                humanProbability: 0.94,
                meanAi: 0.058,
                medianAi: 0.051,
                maxAi: 0.082,
                confidence: 0.940
            },
            explainability: {
                pitchMonotonicity: false,
                spectralAnomaly: false,
                energyFlatnessAnomaly: false,
                details: "Acoustic signals pass neural deepfake filters. However, contextual security rules detected a 10x deviation in requested transaction value combined with acoustic stress indicators."
            },
            chunks: [
                { chunk_index: 0, start_time: 0.0, end_time: 2.0, ai_probability: 0.05, classification: "Human Genuine", confidence: 0.95 },
                { chunk_index: 1, start_time: 2.0, end_time: 4.0, ai_probability: 0.06, classification: "Human Genuine", confidence: 0.94 },
                { chunk_index: 2, start_time: 4.0, end_time: 5.1, ai_probability: 0.07, classification: "Human Genuine", confidence: 0.93 }
            ]
        }
    },

    // Threat Library Encyclopedia
    threatLibrary: [
        {
            id: "THREAT-01",
            title: "AI-Generated Voice (TTS)",
            category: "Synthetic Generation",
            riskLevel: "CRITICAL",
            badgeClass: "badge-high-risk",
            icon: "🤖",
            summary: "Autoregressive and diffusion models synthesizing human speech from text prompts in real-time.",
            detectionMethod: "Multi-band spectral anomaly inspection, phase continuity loss, and micro-jitter forensic tracking.",
            mitigation: "Immediate block, waveform spectral gating, and cryptographic verification challenge."
        },
        {
            id: "THREAT-02",
            title: "Voice Cloning",
            category: "Neural Mimicry",
            riskLevel: "CRITICAL",
            badgeClass: "badge-high-risk",
            icon: "🧬",
            summary: "Few-shot neural models trained on brief audio snippets of a target victim to clone timbre and prosody.",
            detectionMethod: "Biometric vocal tract cross-spectral analysis against enrolled spatial resonance baselines.",
            mitigation: "Layer 2 1-to-1 speaker verification with liveness phrase challenge."
        },
        {
            id: "THREAT-03",
            title: "Voice Conversion (VC)",
            category: "Real-time Morphing",
            riskLevel: "HIGH",
            badgeClass: "badge-high-risk",
            icon: "🎭",
            summary: "Transforming an attacker's pitch and formant frequencies to impersonate authorized personnel.",
            detectionMethod: "Spectral envelope discontinuities, vocoder resampling artifacts, and high-frequency dispersion.",
            mitigation: "Deep neural feature extraction (Wav2Vec2/ECAPA-TDNN) for non-linear artifact isolation."
        },
        {
            id: "THREAT-04",
            title: "Acoustic Replay Attack",
            category: "Physical Playback",
            riskLevel: "HIGH",
            badgeClass: "badge-suspicious",
            icon: "🔁",
            summary: "Playing pre-recorded authentic voice files through external loudspeakers into the receiver microphone.",
            detectionMethod: "Room impulse response (RIR) detection, loudspeaker transfer function harmonics, and pop-filter signatures.",
            mitigation: "Acoustic environment modeling and dynamic time-decay session tokens."
        },
        {
            id: "THREAT-05",
            title: "Speaker Impersonation",
            category: "Social Engineering",
            riskLevel: "MEDIUM",
            badgeClass: "badge-suspicious",
            icon: "👤",
            summary: "Human mimicry or unauthorized individuals asserting ownership over a registered account or session.",
            detectionMethod: "Cosine distance thresholding on 192-dimensional ECAPA-TDNN biometric embeddings.",
            mitigation: "Voice identity enrollment gating with strict similarity scoring (> 0.85 threshold)."
        },
        {
            id: "THREAT-06",
            title: "Contextual Anomaly",
            category: "Behavioral Risk",
            riskLevel: "MEDIUM",
            badgeClass: "badge-suspicious",
            icon: "⚠️",
            summary: "An authentic voice authorization request executing out-of-policy actions, anomalous wire transfers, or coerced requests.",
            detectionMethod: "Transaction magnitude anomaly scoring, behavioral metadata correlation, and vocal stress analysis.",
            mitigation: "Explainable Trust Score downgrade and Step-up Multi-Factor Authentication (MFA)."
        }
    ],

    // Default Historical Analyses
    recentAnalyses: [
        {
            id: "VS-9081",
            fileName: "executive_wire_auth.wav",
            inputType: "Uploaded Audio",
            trustScore: 92,
            verdict: "Authentic & Verified",
            riskLevel: "Low Risk",
            riskClass: "badge-trusted",
            timestamp: "10 mins ago",
            speakerId: "VX-4819",
            claimedIdentity: "Elena Vance",
            duration: "6.4s",
            scenarioRef: "genuine"
        },
        {
            id: "VS-9079",
            fileName: "mic_session_live_88.wav",
            inputType: "Live Audio Recording",
            trustScore: 18,
            verdict: "AI Deepfake Block",
            riskLevel: "High Risk",
            riskClass: "badge-high-risk",
            timestamp: "1 hour ago",
            speakerId: "user_unknown",
            claimedIdentity: "Finance Admin",
            duration: "8.2s",
            scenarioRef: "deepfake"
        },
        {
            id: "VS-9075",
            fileName: "urgent_funds_request.mp3",
            inputType: "Uploaded Audio",
            trustScore: 58,
            verdict: "Context Risk Step-Up",
            riskLevel: "Medium Risk",
            riskClass: "badge-suspicious",
            timestamp: "3 hours ago",
            speakerId: "VX-1092",
            claimedIdentity: "Marcus Brody",
            duration: "5.1s",
            scenarioRef: "suspiciousContext"
        },
        {
            id: "VS-9068",
            fileName: "customer_id_verify.m4a",
            inputType: "Uploaded Audio",
            trustScore: 89,
            verdict: "Authentic & Verified",
            riskLevel: "Low Risk",
            riskClass: "badge-trusted",
            timestamp: "Yesterday",
            speakerId: "VX-7731",
            claimedIdentity: "Sarah Connor",
            duration: "4.8s",
            scenarioRef: "genuine"
        },
        {
            id: "VS-9054",
            fileName: "mic_login_verify.wav",
            inputType: "Live Audio Recording",
            trustScore: 95,
            verdict: "Authentic & Verified",
            riskLevel: "Low Risk",
            riskClass: "badge-trusted",
            timestamp: "Yesterday",
            speakerId: "VX-4819",
            claimedIdentity: "Elena Vance",
            duration: "5.5s",
            scenarioRef: "genuine"
        }
    ],

    // Privacy Architecture Pipeline Steps
    privacyPipeline: [
        {
            step: "01",
            title: "Audio Input Ingestion",
            icon: "🎙️",
            desc: "Audio stream or uploaded file is captured in-memory. Zero unencrypted network transit."
        },
        {
            step: "02",
            title: "Acoustic Feature Extraction",
            icon: "⚡",
            desc: "Wav2Vec2 and ECAPA-TDNN extract non-reversible mathematical neural vectors without persisting raw biometric identity."
        },
        {
            step: "03",
            title: "Multi-Layer Security Analysis",
            icon: "🛡️",
            desc: "Independent evaluation across synthetic vocoder artifacts, speaker cosine distance, and contextual risk thresholds."
        },
        {
            step: "04",
            title: "Explainable Trust Computation",
            icon: "🧠",
            desc: "Signals are aggregated into an explainable 0–100 Trust Score with transparent contribution weights."
        },
        {
            step: "05",
            title: "Session Data Handling",
            icon: "🔒",
            desc: "Analysis telemetry is held in local session cache. Audio memory buffers are released post-analysis."
        }
    ]
};

window.MOCK_DATA = MOCK_DATA;
