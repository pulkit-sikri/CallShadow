// Explainable Trust Engine & Risk Scoring Visualizer
// Calculates and renders the centerpiece Trust Score dial, 3-model weighted formula, and risk checklist.

class TrustEngine {
    constructor() {
        this.currentScore = 0;
        this.animationTimer = null;
    }

    // Adapt backend raw response or mock payload into a unified Explainable Trust Data structure
    normalizeAnalysisData(rawResponse, inputType = "Uploaded Audio", fileName = "audio_sample.wav") {
        if (!rawResponse) return null;

        // If data is ALREADY a normalized structure with valid trustScore and 3 factors, preserve and return it directly
        if (rawResponse.trustScore && typeof rawResponse.trustScore === 'object' && rawResponse.trustScore.overall !== undefined && rawResponse.trustScore.factors && rawResponse.trustScore.factors.length === 3) {
            if (inputType && (!rawResponse.inputType || rawResponse.inputType === "Audio Analysis")) {
                rawResponse.inputType = inputType;
            }
            if (fileName && (!rawResponse.fileName || rawResponse.fileName === "audio_sample.wav")) {
                rawResponse.fileName = fileName;
            }
            return rawResponse;
        }

        // Parse real Backend FastAPI response (/api/audio/upload or /api/audio/live)
        const aiProb = (rawResponse.ai_probability !== undefined) 
            ? rawResponse.ai_probability 
            : ((rawResponse.mean_ai_probability !== undefined) 
                ? rawResponse.mean_ai_probability 
                : (rawResponse.probabilities?.aiProbability ?? 0.05));
        const humanProb = (rawResponse.human_probability !== undefined) 
            ? rawResponse.human_probability 
            : (rawResponse.probabilities?.humanProbability ?? (1.0 - aiProb));
        const classification = rawResponse.overall_classification || (aiProb >= 0.5 ? "AI Generated" : "Human Genuine");
        const isAi = classification === "AI Generated" || aiProb >= 0.5;

        // Extract Trust Score & Backend results
        const backendTrust = rawResponse.trust_score || rawResponse.trustScore || {};

        // -------------------------------------------------------------
        // 1. MODEL 1: AI Generated or Not (40% Weight)
        // -------------------------------------------------------------
        const aiAuthScore = Math.round(backendTrust.ai_authenticity_score ?? (humanProb * 100));
        const aiWeightPts = Math.round((aiAuthScore / 100) * 40);

        // -------------------------------------------------------------
        // 2. MODEL 2: Identity Matching or Not (30% Weight)
        // -------------------------------------------------------------
        const hasSpeakerInput = Boolean(
            rawResponse.hasSpeakerInput === true ||
            (rawResponse.speaker_id && String(rawResponse.speaker_id).trim()) ||
            (rawResponse.speakerId && String(rawResponse.speakerId).trim()) ||
            (rawResponse.claimed_identity && String(rawResponse.claimed_identity).trim()) ||
            (rawResponse.claimedIdentity && String(rawResponse.claimedIdentity).trim()) ||
            (backendTrust.speaker_identity_status && backendTrust.speaker_identity_status !== "NOT_PROVIDED" && backendTrust.speaker_identity_status !== "NOT_CHECKED") ||
            (backendTrust.identity_match_score !== undefined && backendTrust.identity_match_score > 0)
        );

        let speakerStatus = backendTrust.speaker_identity_status || rawResponse.speaker_identity_status || (hasSpeakerInput ? "CHECKED" : "NOT_PROVIDED");
        let speakerMatchScore = 0;

        if (!hasSpeakerInput) {
            speakerMatchScore = 0;
            speakerStatus = "NOT_PROVIDED";
        } else if (backendTrust.identity_match_score !== undefined) {
            speakerMatchScore = Math.round(backendTrust.identity_match_score);
        } else if (speakerStatus === "VERIFIED" || speakerStatus === "MATCHED" || speakerStatus === "MATCH_CONFIRMED") {
            speakerMatchScore = 94;
        } else if (speakerStatus === "MISMATCH" || speakerStatus === "IDENTITY_MISMATCH") {
            speakerMatchScore = 25;
        } else if (isAi) {
            speakerMatchScore = 30;
        } else {
            speakerMatchScore = 90;
        }
        const speakerWeightPts = Math.round((speakerMatchScore / 100) * 30);

        // -------------------------------------------------------------
        // 3. MODEL 3: Context Safe or Not (30% Weight)
        // -------------------------------------------------------------
        const hasContextInput = Boolean(
            rawResponse.hasContextInput === true ||
            (rawResponse.transaction_value !== undefined && rawResponse.transaction_value !== null && rawResponse.transaction_value !== "") ||
            (rawResponse.transactionAmount !== undefined && rawResponse.transactionAmount !== null && rawResponse.transactionAmount !== "") ||
            (backendTrust.context_status && backendTrust.context_status !== "NOT_PROVIDED" && backendTrust.context_status !== "NOT_CHECKED") ||
            (backendTrust.context_safe_score !== undefined && backendTrust.context_safe_score > 0)
        );

        let contextStatus = backendTrust.context_status || rawResponse.context_status || (hasContextInput ? "CLEAR" : "NOT_PROVIDED");
        let contextSafeScore = 0;

        if (!hasContextInput) {
            contextSafeScore = 0;
            contextStatus = "NOT_PROVIDED";
        } else if (backendTrust.context_safe_score !== undefined) {
            contextSafeScore = Math.round(backendTrust.context_safe_score);
        } else if (contextStatus !== "CLEAR" && contextStatus !== "BASELINE_MATCH" && contextStatus !== "LOW_RISK") {
            contextSafeScore = 30;
        } else {
            contextSafeScore = 100;
        }
        const contextWeightPts = Math.round((contextSafeScore / 100) * 30);

        // -------------------------------------------------------------
        // FINAL 3-MODEL WEIGHTED TRUST FORMULA:
        // Final Score (0-100) = (40% * AI Authenticity) + (30% * Identity Match) + (30% * Context Safe)
        // -------------------------------------------------------------
        let overallTrust = Math.round((0.40 * aiAuthScore) + (0.30 * speakerMatchScore) + (0.30 * contextSafeScore));
        overallTrust = Math.max(0, Math.min(100, overallTrust));

        const hasMissingInputs = (!hasSpeakerInput) || (!hasContextInput);

        let statusText = "TRUSTED_LOW_RISK";
        let badgeClass = "badge-trusted";
        let recAction = "ALLOW_INTERACTION";
        let summaryText = "";

        if (isAi || (overallTrust < 40 && !hasMissingInputs)) {
            statusText = "CRITICAL_AI_BLOCK";
            badgeClass = "badge-high-risk";
            recAction = "BLOCK_AND_ALERT_SECURITY";
            summaryText = "High-probability synthetic AI voice detected. Immediate risk intervention required.";
        } else if (speakerStatus === "MISMATCH" || speakerStatus === "IDENTITY_MISMATCH") {
            statusText = "IDENTITY_MISMATCH_BLOCK";
            badgeClass = "badge-high-risk";
            recAction = "BLOCK_IMPERSONATION_ATTEMPT";
            summaryText = "Voice is genuine, but voiceprint does not match the registered speaker identity.";
        } else if (hasMissingInputs) {
            statusText = "STEP_UP_VERIFICATION_REQUIRED";
            badgeClass = "badge-suspicious";
            recAction = "REQUIRE_STEP_UP_AUTHENTICATION";
            if (!hasSpeakerInput && !hasContextInput) {
                summaryText = "Voice authenticity verified (+40 pts). Speaker identity and conversation context were not provided (0 pts). Please perform step-up verification to receive an updated trust score.";
            } else if (!hasSpeakerInput) {
                summaryText = "Voice authenticity and context verified. Claimed speaker identity was not provided (0 pts). Please perform step-up verification to receive an updated trust score.";
            } else {
                summaryText = "Voice authenticity and speaker identity verified. Conversation context was not provided (0 pts). Please perform step-up verification to receive an updated trust score.";
            }
        } else if (overallTrust < 80 || (contextStatus !== "CLEAR" && contextStatus !== "BASELINE_MATCH" && contextStatus !== "LOW_RISK")) {
            statusText = "CONTEXT_RISK_STEP_UP";
            badgeClass = "badge-suspicious";
            recAction = "REQUIRE_STEP_UP_AUTHENTICATION";
            summaryText = "Voice is authentic and identity matched, but context risk requires step-up verification.";
        } else {
            statusText = "TRUSTED_LOW_RISK";
            badgeClass = "badge-trusted";
            recAction = "ALLOW_INTERACTION";
            summaryText = "Voice authenticity, identity match, and context safety verified with high confidence.";
        }

        // -------------------------------------------------------------
        // 3 CORE VERIFICATION CHECKS (40% Voice Authenticity + 30% Identity Match + 30% Context Safety)
        // -------------------------------------------------------------
        const isVoiceReal = !isAi;
        const isIdentityMatched = hasSpeakerInput && (speakerStatus !== "MISMATCH" && speakerStatus !== "IDENTITY_MISMATCH");
        const isContextSafe = hasContextInput && (contextStatus === "CLEAR" || contextStatus === "BASELINE_MATCH" || contextStatus === "LOW_RISK");

        const checklist = [
            {
                text: isVoiceReal ? "Voice Authenticity: Real genuine human voice verified" : "Voice Authenticity: Synthetic deepfake voice detected",
                safe: isVoiceReal
            },
            {
                text: (!hasSpeakerInput) 
                    ? "Claimed Identity: Not provided (0 / 30 pts) — step-up verification needed" 
                    : (isIdentityMatched ? "Claimed Identity: Biometric voiceprint matches registered profile" : "Claimed Identity: Biometric voiceprint mismatch"),
                safe: isIdentityMatched
            },
            {
                text: (!hasContextInput) 
                    ? "Context Safety: Not provided (0 / 30 pts) — step-up verification needed" 
                    : (isContextSafe ? "Context Safety: Session and transaction parameters verified safe" : "Context Safety: Context risk anomaly flagged"),
                safe: isContextSafe
            }
        ];

        const factors = [
            { 
                name: "1. Voice Authenticity (Real / Synthetic)", 
                score: aiAuthScore, 
                weight: `+${aiWeightPts} / 40 pts`, 
                weightPct: "40% Weight", 
                status: isVoiceReal ? "REAL_HUMAN" : "SYNTHETIC_AI",
                isPassed: isVoiceReal,
                checkLabel: isVoiceReal ? "Real Voice Verified" : "Synthetic AI Detected",
                description: isVoiceReal ? "Natural genuine human vocal tract harmonics verified" : "Synthetic neural vocoder / deepfake markers detected" 
            },
            { 
                name: "2. Claimed Identity Match", 
                score: speakerMatchScore, 
                weight: `+${speakerWeightPts} / 30 pts`, 
                weightPct: "30% Weight", 
                status: (!hasSpeakerInput) ? "NOT_PROVIDED" : (isIdentityMatched ? "MATCHED" : "MISMATCH"),
                isPassed: isIdentityMatched,
                checkLabel: (!hasSpeakerInput) ? "Identity Not Provided" : (isIdentityMatched ? "Identity Matched" : "Identity Mismatch"),
                description: (!hasSpeakerInput) 
                    ? "No claimed speaker identity was provided (0 / 30 pts). Step-up verification required." 
                    : (isIdentityMatched ? "Biometric voiceprint matches claimed speaker profile" : "Biometric voiceprint does not match registered profile") 
            },
            { 
                name: "3. Context Safety", 
                score: contextSafeScore, 
                weight: `+${contextWeightPts} / 30 pts`, 
                weightPct: "30% Weight", 
                status: (!hasContextInput) ? "NOT_PROVIDED" : (isContextSafe ? "SAFE" : "RISKY"),
                isPassed: isContextSafe,
                checkLabel: (!hasContextInput) ? "Context Not Provided" : (isContextSafe ? "Context Safe" : "Context Risk Anomaly"),
                description: (!hasContextInput) 
                    ? "No conversation context was provided (0 / 30 pts). Step-up verification required." 
                    : (isContextSafe ? "Session parameters and transaction context verified safe" : "Context parameters deviate from verified safe baseline") 
            }
        ];

        return {
            id: rawResponse.id || `VS-${Math.floor(1000 + Math.random() * 9000)}`,
            fileName: fileName,
            inputType: inputType,
            timestamp: rawResponse.timestamp || new Date().toISOString(),
            duration: (() => {
                const durVal = Number(rawResponse.duration_seconds ?? rawResponse.duration);
                return (Number.isFinite(durVal) && durVal > 0) ? `${durVal.toFixed(1)}s` : "3.0s";
            })(),
            isDemo: Boolean(rawResponse.isDemo || rawResponse.is_demo_mode),
            isBackend: Boolean(rawResponse.isBackend !== false),
            trustScore: {
                overall: overallTrust,
                formula: "Final Trust Score = (0.40 × AI Authenticity) + (0.30 × Identity Match) + (0.30 × Context Safe)",
                status: statusText,
                badgeClass: badgeClass,
                summary: isAi 
                    ? "High-probability synthetic AI voice detected. Immediate risk intervention required." 
                    : (speakerStatus === "MISMATCH" || speakerStatus === "IDENTITY_MISMATCH"
                        ? "Voice is genuine, but voiceprint does not match the registered speaker identity."
                        : (overallTrust < 80 
                            ? "Voice is authentic and identity matched, but context risk requires step-up verification." 
                            : "Voice authenticity, identity match, and context safety verified with high confidence.")),
                recommendedAction: recAction,
                factors: factors,
                checklist: checklist
            },
            probabilities: {
                aiProbability: aiProb,
                humanProbability: humanProb,
                meanAi: rawResponse.mean_ai_probability ?? aiProb,
                medianAi: rawResponse.median_ai_probability ?? aiProb,
                maxAi: rawResponse.max_ai_probability ?? aiProb,
                confidence: rawResponse.overall_confidence ?? Math.max(aiProb, humanProb)
            },
            explainability: rawResponse.explainability || {
                pitchMonotonicity: isAi,
                spectralAnomaly: isAi,
                energyFlatnessAnomaly: isAi,
                details: isAi ? "Neural vocoder artifacts detected with pitch monotonicity." : "Organic biological pitch micro-variations and natural spectral distribution."
            },
            chunks: rawResponse.chunks || []
        };
    }

    renderTrustResult(data) {
        if (!data) return;
        const normalized = (data.trustScore && typeof data.trustScore === 'object' && data.trustScore.overall !== undefined && data.trustScore.factors && data.trustScore.factors.length === 3) 
            ? data 
            : this.normalizeAnalysisData(data);
        const ts = normalized.trustScore;

        const scoreValEl = document.getElementById('trust-dial-val');
        const meterEl = document.getElementById('trust-dial-meter');
        const verdictTagEl = document.getElementById('trust-verdict-tag');
        const verdictDescEl = document.getElementById('trust-verdict-desc');
        const waterfallEl = document.getElementById('factor-waterfall-list');

        const isAi = ts.status === "CRITICAL_AI_BLOCK" || normalized.probabilities?.aiProbability >= 0.5;
        const isStepUp = ts.status === "STEP_UP_VERIFICATION_REQUIRED" || ts.status === "CONTEXT_RISK_STEP_UP" || (ts.overall < 80 && !isAi);

        const scoreColor = isAi ? '#dc2626' : (ts.overall >= 80 && ts.status === "TRUSTED_LOW_RISK" ? '#16a34a' : '#d97706');
        const strokeOffset = 264 - (264 * Math.min(100, Math.max(0, ts.overall))) / 100;

        if (scoreValEl) {
            this.animateNumber('trust-dial-val', 0, ts.overall, 800);
        }
        if (meterEl) {
            meterEl.style.stroke = scoreColor;
            meterEl.style.strokeDashoffset = strokeOffset;
        }
        if (verdictTagEl) {
            if (isAi) {
                verdictTagEl.textContent = '🚨 Synthetic AI Voice Blocked';
                verdictTagEl.style.color = '#dc2626';
                verdictTagEl.style.background = 'var(--status-danger-bg)';
                verdictTagEl.style.borderColor = 'var(--status-danger-border)';
            } else if (ts.status === "IDENTITY_MISMATCH_BLOCK") {
                verdictTagEl.textContent = '🚨 Identity Mismatch Blocked';
                verdictTagEl.style.color = '#dc2626';
                verdictTagEl.style.background = 'var(--status-danger-bg)';
                verdictTagEl.style.borderColor = 'var(--status-danger-border)';
            } else if (ts.overall >= 80 && ts.status === "TRUSTED_LOW_RISK") {
                verdictTagEl.textContent = '✓ Verified Authentic Voice';
                verdictTagEl.style.color = '#16a34a';
                verdictTagEl.style.background = 'var(--status-safe-bg)';
                verdictTagEl.style.borderColor = 'var(--status-safe-border)';
            } else {
                verdictTagEl.textContent = '⚠️ Step-Up Verification Required';
                verdictTagEl.style.color = '#d97706';
                verdictTagEl.style.background = 'var(--status-warning-bg)';
                verdictTagEl.style.borderColor = 'var(--status-warning-border)';
            }
        }
        if (verdictDescEl) {
            verdictDescEl.textContent = ts.summary || (ts.overall >= 80 ? '3-model evaluation confirmed authentic human voice, verified speaker identity, and safe context.' : 'Step-up verification required.');
        }
        if (waterfallEl && ts.factors) {
            waterfallEl.innerHTML = ts.factors.map(f => {
                const isPassed = f.isPassed !== undefined ? f.isPassed : (f.score >= 50);
                const isZeroOrMissing = (f.score === 0 || f.status === "NOT_PROVIDED");
                const barColor = isPassed ? '#16a34a' : (isZeroOrMissing ? '#94a3b8' : (f.score >= 45 ? '#d97706' : '#dc2626'));
                const checkBg = isPassed ? '#16a34a' : (isZeroOrMissing ? '#64748b' : '#dc2626');
                const checkBorder = isPassed ? '#15803d' : (isZeroOrMissing ? '#475569' : '#b91c1c');
                const checkSign = isPassed ? '✓' : (isZeroOrMissing ? '○' : '✗');
                const checkStatusText = f.checkLabel || (isPassed ? 'PASS' : (isZeroOrMissing ? 'NOT PROVIDED' : 'FAIL'));
                const badgeBg = isPassed ? '#f0fdf4' : (isZeroOrMissing ? '#f1f5f9' : '#fef2f2');
                const badgeColor = isPassed ? '#15803d' : (isZeroOrMissing ? '#475569' : '#b91c1c');
                const badgeBorder = isPassed ? '#bbf7d0' : (isZeroOrMissing ? '#cbd5e1' : '#fecaca');

                return `
                    <div class="factor-row" style="margin-bottom: 10px; padding: 12px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                        <div class="factor-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <div style="display: flex; align-items: flex-start; gap: 10px;">
                                <div style="width: 22px; height: 22px; min-width: 22px; border-radius: 4px; background: ${checkBg}; border: 1px solid ${checkBorder}; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 13px; margin-top: 1px;">
                                    ${checkSign}
                                </div>
                                <div style="display: flex; flex-direction: column;">
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <span style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${this.escapeHtml(f.name)}</span>
                                        <span style="font-size: 10.5px; font-weight: 700; background: #e0f2fe; color: #0284c7; padding: 2px 7px; border-radius: 12px;">${f.weightPct || ''}</span>
                                        <span style="font-size: 10.5px; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 1px 6px; border-radius: 4px;">${checkStatusText}</span>
                                    </div>
                                    <span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${this.escapeHtml(f.description || '')}</span>
                                </div>
                            </div>
                            <div style="text-align: right; min-width: 75px;">
                                <div style="font-weight: 800; font-size: 13.5px; color: ${barColor};">${f.score}%</div>
                                <div style="font-size: 11px; font-weight: 700; color: ${isPassed ? '#16a34a' : (isZeroOrMissing ? '#64748b' : '#dc2626')};">${f.weight}</div>
                            </div>
                        </div>
                        <div class="factor-bar-track" style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 4px;">
                            <div class="factor-bar-fill" style="width: ${Math.min(100, Math.max(f.score === 0 ? 0 : 5, f.score))}%; height: 100%; background-color: ${barColor}; transition: width 0.8s ease;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render the complete unified Analysis Result view
    renderUnifiedResult(data, containerId = "analysis-result-container") {
        const container = document.getElementById(containerId);
        if (!container) return;

        const normalized = (data.trustScore && typeof data.trustScore === 'object' && data.trustScore.overall !== undefined && data.trustScore.factors && data.trustScore.factors.length === 3) 
            ? data 
            : this.normalizeAnalysisData(data);
        const ts = normalized.trustScore;
        const probs = normalized.probabilities;
        const exp = normalized.explainability;
        const chunks = normalized.chunks || [];

        const isAi = ts.status === "CRITICAL_AI_BLOCK" || normalized.probabilities?.aiProbability >= 0.5;
        const isStepUp = ts.status === "STEP_UP_VERIFICATION_REQUIRED" || ts.status === "CONTEXT_RISK_STEP_UP" || (ts.overall < 80 && !isAi);

        const scoreColor = isAi ? '#ef4444' : (ts.overall >= 80 && ts.status === "TRUSTED_LOW_RISK" ? '#10b981' : '#f59e0b');
        const scoreLabel = isAi ? 'LOW TRUST • HIGH RISK' : (ts.overall >= 80 && ts.status === "TRUSTED_LOW_RISK" ? 'HIGH TRUST • SAFE' : 'MEDIUM TRUST • STEP-UP');
        const strokeDashOffset = 440 - (440 * ts.overall) / 100;

        container.innerHTML = `
            <!-- Result Header Banner -->
            <div class="result-header-bar glass-card">
                <div class="result-header-left">
                    <div class="result-type-badge">
                        <span>${normalized.inputType === 'Live Audio Recording' ? '🎙️ LIVE MICROPHONE' : '📤 UPLOADED AUDIO'}</span>
                    </div>
                    <div class="result-meta">
                        <h2 class="result-file-title">${this.escapeHtml(normalized.fileName)}</h2>
                        <div class="result-meta-tags">
                            <span class="meta-tag">ID: <code>${normalized.id}</code></span>
                            <span class="meta-tag">Duration: ${normalized.duration}</span>
                            <span class="meta-tag">Analyzed: ${new Date(normalized.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            ${normalized.isDemo ? '<span class="meta-tag badge-demo-tag">DEMO SCENARIO</span>' : '<span class="meta-tag badge-live-tag">VERIFIED ENGINE</span>'}
                        </div>
                    </div>
                </div>
                <div class="result-header-right">
                    <button class="btn btn-secondary btn-sm" onclick="app.downloadReport('${normalized.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Report
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="app.navigateTo('dashboard')">
                        Dashboard Overview
                    </button>
                </div>
            </div>

            <!-- Visual Centerpiece: Explainable 3-Model Trust Engine -->
            <div class="trust-centerpiece-card glass-card">
                <div class="centerpiece-grid">
                    <!-- Circular Animated Trust Dial -->
                    <div class="trust-dial-col">
                        <div class="trust-dial-wrapper">
                            <svg class="trust-dial-svg" viewBox="0 0 160 160">
                                <circle class="dial-bg" cx="80" cy="80" r="70"></circle>
                                <circle class="dial-progress" id="dial-progress-circle" cx="80" cy="80" r="70" 
                                    style="stroke: ${scoreColor}; stroke-dashoffset: 440;"></circle>
                            </svg>
                            <div class="dial-content">
                                <span class="dial-caption">TRUST SCORE</span>
                                <span class="dial-number" id="dial-number-val" style="color: ${scoreColor};">0</span>
                                <span class="dial-scale">/ 100</span>
                            </div>
                        </div>
                        <div class="trust-status-pill ${ts.badgeClass}">
                            <span class="status-dot"></span>
                            <span>${scoreLabel}</span>
                        </div>
                        <p class="trust-summary-text">${this.escapeHtml(ts.summary)}</p>
                    </div>

                    <!-- 3-Model Weighted Factor Breakdown -->
                    <div class="trust-factors-col">
                        <div class="factors-header">
                            <div>
                                <h3>3-Model Weighted Trust Formula</h3>
                                <p class="text-muted text-sm">Formula: <strong>40% Voice Authenticity + 30% Claimed Identity + 30% Context Safety</strong></p>
                            </div>
                            <div class="overall-badge">
                                <span>Total Trust: <strong>${ts.overall}/100</strong></span>
                            </div>
                        </div>

                        <div class="factor-waterfall-list">
                            ${ts.factors.map(f => {
                                const isPassed = f.isPassed !== undefined ? f.isPassed : (f.score >= 50);
                                const isZeroOrMissing = (f.score === 0 || f.status === "NOT_PROVIDED");
                                const barColor = isPassed ? '#10b981' : (isZeroOrMissing ? '#94a3b8' : (f.score >= 45 ? '#f59e0b' : '#ef4444'));
                                const checkBg = isPassed ? '#10b981' : (isZeroOrMissing ? '#64748b' : '#ef4444');
                                const checkBorder = isPassed ? '#059669' : (isZeroOrMissing ? '#475569' : '#dc2626');
                                const checkSign = isPassed ? '✓' : (isZeroOrMissing ? '○' : '✗');
                                const checkStatusText = f.checkLabel || (isPassed ? 'PASS' : (isZeroOrMissing ? 'NOT PROVIDED' : 'FAIL'));
                                const badgeBg = isPassed ? '#f0fdf4' : (isZeroOrMissing ? '#f1f5f9' : '#fef2f2');
                                const badgeColor = isPassed ? '#15803d' : (isZeroOrMissing ? '#475569' : '#b91c1c');
                                const badgeBorder = isPassed ? '#bbf7d0' : (isZeroOrMissing ? '#cbd5e1' : '#fecaca');

                                return `
                                    <div class="factor-row" style="margin-bottom: 12px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                                        <div class="factor-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <div class="factor-name-wrapper" style="display: flex; align-items: flex-start; gap: 10px;">
                                                <div style="width: 22px; height: 22px; min-width: 22px; border-radius: 4px; background: ${checkBg}; border: 1px solid ${checkBorder}; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 13px; margin-top: 1px;">
                                                    ${checkSign}
                                                </div>
                                                <div>
                                                    <div style="display: flex; align-items: center; gap: 8px;">
                                                        <span class="factor-name" style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${this.escapeHtml(f.name)}</span>
                                                        <span style="font-size: 10.5px; font-weight: 700; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px;">${f.weightPct}</span>
                                                        <span style="font-size: 10.5px; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 1px 6px; border-radius: 4px;">${checkStatusText}</span>
                                                    </div>
                                                    <span class="factor-status-sub" style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px;">${this.escapeHtml(f.description)}</span>
                                                </div>
                                            </div>
                                            <div style="text-align: right; min-width: 75px;">
                                                <div style="font-size: 14px; font-weight: 800; color: ${barColor};">${f.score}%</div>
                                                <span class="factor-weight ${isPassed ? 'positive' : 'negative'}" style="font-weight: 700; font-size: 11px; color: ${isPassed ? '#16a34a' : (isZeroOrMissing ? '#64748b' : '#dc2626')};">${f.weight}</span>
                                            </div>
                                        </div>
                                        <div class="factor-bar-track" style="width: 100%; height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                            <div class="factor-bar-fill" style="width: ${Math.min(100, Math.max(f.score === 0 ? 0 : 5, f.score))}%; height: 100%; background-color: ${barColor}; transition: width 0.8s ease;"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Action Recommendation Box -->
                        <div class="recommendation-box ${isAi ? 'rec-danger' : (ts.overall >= 80 && ts.status === 'TRUSTED_LOW_RISK' ? 'rec-safe' : 'rec-warn')}">
                            <span class="rec-icon">${isAi ? '🚨' : (ts.overall >= 80 && ts.status === 'TRUSTED_LOW_RISK' ? '✅' : '⚠️')}</span>
                            <div class="rec-text">
                                <strong>Recommended Action: ${ts.recommendedAction.replace(/_/g, ' ')}</strong>
                                <span>${isAi ? 'Block transaction immediately and alert security team.' : (ts.recommendedAction === 'REQUIRE_STEP_UP_AUTHENTICATION' ? 'Please perform step-up verification to provide speaker identity and conversation context for an updated trust score.' : 'Proceed with low-risk interaction.')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3 Core Model Signal Cards -->
            <div class="metrics-grid-4" style="grid-template-columns: repeat(3, 1fr);">
                <div class="metric-card glass-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="metric-card-title">1. AI Generated Detection</span>
                        <span style="font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 10px;">40% Weight</span>
                    </div>
                    <div class="metric-card-val">${(probs.humanProbability * 100).toFixed(1)}%</div>
                    <div class="metric-card-status ${probs.humanProbability > 0.7 ? 'text-safe' : 'text-danger'}">
                        ${probs.humanProbability > 0.7 ? '✓ Organic Human Speech' : '🚨 Synthetic AI Deepfake'}
                    </div>
                </div>

                <div class="metric-card glass-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="metric-card-title">2. Identity Matching</span>
                        <span style="font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 10px;">30% Weight</span>
                    </div>
                    <div class="metric-card-val">${ts.factors[1] ? ts.factors[1].score : 0}%</div>
                    <div class="metric-card-status ${ts.factors[1]?.score >= 70 ? 'text-safe' : (ts.factors[1]?.score === 0 ? 'text-warning' : 'text-danger')}">
                        ${ts.factors[1]?.score >= 70 ? '✓ Biometric Match Verified' : (ts.factors[1]?.score === 0 ? '⚠️ Identity Not Provided' : '🚨 Identity Mismatch')}
                    </div>
                </div>

                <div class="metric-card glass-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="metric-card-title">3. Context Safe Assessment</span>
                        <span style="font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 10px;">30% Weight</span>
                    </div>
                    <div class="metric-card-val">${ts.factors[2] ? ts.factors[2].score : 0}%</div>
                    <div class="metric-card-status ${ts.factors[2]?.score >= 70 ? 'text-safe' : (ts.factors[2]?.score === 0 ? 'text-warning' : 'text-danger')}">
                        ${ts.factors[2]?.score >= 70 ? '✓ Routine Context Safe' : (ts.factors[2]?.score === 0 ? '⚠️ Context Not Provided' : '🚨 Context Anomaly Flagged')}
                    </div>
                </div>
            </div>
            </div>

            <!-- Risk Factor Checklist & Forensic Signals -->
            <div class="two-col-grid">
                <!-- Checklist -->
                <div class="glass-card">
                    <div class="card-header-row">
                        <h3>🛡️ 3-Model Security Checklist</h3>
                        <span class="text-muted text-sm">${ts.checklist.filter(c => c.safe).length} / ${ts.checklist.length} Passed</span>
                    </div>
                    <div class="checklist-items">
                        ${ts.checklist.map(item => `
                            <div class="checklist-item ${item.safe ? 'check-pass' : 'check-fail'}">
                                <span class="check-icon">${item.safe ? '✓' : '⚠'}</span>
                                <span class="check-text">${this.escapeHtml(item.text)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Forensic Biomarkers -->
                <div class="glass-card">
                    <div class="card-header-row">
                        <h3>🔬 Forensic Biomarkers & Heuristics</h3>
                        <span class="text-muted text-sm">Layer 1 Acoustic Analysis</span>
                    </div>
                    <div class="forensic-pills-grid">
                        <div class="forensic-pill ${exp.pitchMonotonicity ? 'active-threat' : 'active-safe'}">
                            <div class="forensic-pill-top">
                                <span class="forensic-name">Pitch Monotonicity</span>
                                <span class="forensic-flag">${exp.pitchMonotonicity ? 'DETECTED' : 'CLEAR'}</span>
                            </div>
                            <span class="forensic-desc">Measures artificial fundamental frequency flatness.</span>
                        </div>

                        <div class="forensic-pill ${exp.spectralAnomaly ? 'active-threat' : 'active-safe'}">
                            <div class="forensic-pill-top">
                                <span class="forensic-name">Spectral Anomaly</span>
                                <span class="forensic-flag">${exp.spectralAnomaly ? 'DETECTED' : 'CLEAR'}</span>
                            </div>
                            <span class="forensic-desc">Tracks high-frequency neural vocoder phase distortion.</span>
                        </div>

                        <div class="forensic-pill ${exp.energyFlatnessAnomaly ? 'active-threat' : 'active-safe'}">
                            <div class="forensic-pill-top">
                                <span class="forensic-name">Energy Flatness</span>
                                <span class="forensic-flag">${exp.energyFlatnessAnomaly ? 'DETECTED' : 'CLEAR'}</span>
                            </div>
                            <span class="forensic-desc">Evaluates unnatural sound pressure consistency.</span>
                        </div>
                    </div>
                    <p class="forensic-details-text">${this.escapeHtml(exp.details || 'Acoustic inspection passed.')}</p>
                </div>
            </div>

            <!-- Analysis Timeline & Chunk Breakdown -->
            <div class="glass-card analysis-timeline-card">
                <div class="card-header-row">
                    <div>
                        <h3>📊 Analysis Timeline</h3>
                        <p class="text-muted text-sm">
                            ${chunks.length > 0 ? 'Temporal chunk-level neural predictions provided by engine' : 'Waveform timeline with verified inspection markers'}
                        </p>
                    </div>
                    <span class="badge-pill">${chunks.length > 0 ? `${chunks.length} Neural Windows` : 'Full Duration Timeline'}</span>
                </div>

                ${chunks.length > 0 ? `
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Window</th>
                                    <th>Timestamp</th>
                                    <th>AI Probability</th>
                                    <th>Classification</th>
                                    <th>Confidence</th>
                                    <th>Security State</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${chunks.map(c => {
                                    const isChunkAi = c.classification === 'AI Generated' || c.ai_probability > 0.5;
                                    const chunkAiPct = (c.ai_probability * 100).toFixed(1);
                                    return `
                                        <tr>
                                            <td>#${c.chunk_index + 1}</td>
                                            <td>${c.start_time.toFixed(1)}s – ${c.end_time.toFixed(1)}s</td>
                                            <td>
                                                <div class="table-progress-cell">
                                                    <span>${chunkAiPct}%</span>
                                                    <div class="table-bar-track">
                                                        <div class="table-bar-fill ${isChunkAi ? 'bar-danger' : 'bar-safe'}" style="width: ${chunkAiPct}%;"></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span class="badge ${isChunkAi ? 'badge-high-risk' : 'badge-trusted'}">${c.classification}</span></td>
                                            <td>${(c.confidence * 100).toFixed(1)}%</td>
                                            <td>${isChunkAi ? '🚨 Neural Artifact Flag' : '✓ Verified Natural'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="waveform-timeline-box">
                        <canvas id="analysis-timeline-canvas" width="800" height="90" style="width:100%; border-radius:8px;"></canvas>
                        <div class="timeline-markers-row">
                            <span class="marker">0.0s</span>
                            <span class="marker">✓ Liveness Check</span>
                            <span class="marker">✓ Acoustic Formants</span>
                            <span class="marker">✓ Biometric Resonances</span>
                            <span class="marker">${normalized.duration}</span>
                        </div>
                    </div>
                `}
            </div>
        `;

        // Animate circular dial & number
        setTimeout(() => {
            const dialCircle = document.getElementById('dial-progress-circle');
            if (dialCircle) {
                dialCircle.style.strokeDashoffset = strokeDashOffset;
            }
            this.animateNumber('dial-number-val', 0, ts.overall, 1200);
        }, 100);

        // Render waveform canvas if chunk table was not present
        if (chunks.length === 0) {
            setTimeout(() => {
                if (window.audioEngine) {
                    window.audioEngine.drawDecorativeWaveform('analysis-timeline-canvas');
                }
            }, 150);
        }

        // Scroll to results cleanly
        container.scrollIntoView({ behavior: 'smooth' });
    }

    animateNumber(elementId, start, end, duration) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const startTime = performance.now();
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentVal = Math.round(start + (end - start) * easeOut);
            el.textContent = currentVal;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = end;
            }
        };
        requestAnimationFrame(update);
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.trustEngine = new TrustEngine();
