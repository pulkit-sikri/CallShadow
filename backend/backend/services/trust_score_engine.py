"""
Trust Score Engine - combines all three analysis layers into ONE final
decision. This is "Layer 3: Context-Aware Risk Fusion" from the project's
original feature list, implemented as the actual engine that fills in the
previously-unused TrustScoreResult schema (which existed with placeholder
"NOT_IMPLEMENTED" values).

Design principle carried over from the two-layer fusion logic already
specified for the Antigravity integration (verdict_fusion.py): use an
explainable decision tree, not a single blended number. Each branch has a
distinct, statable meaning - important for a fraud/safety tool where
"why was this flagged" needs a clear answer, not just a score.

Inputs, one from each layer:
- voice_authenticity: float (0-1) - Layer 1's ai_probability, i.e. how
  likely the audio is synthetic/AI-generated. Lower = more human-like.
- speaker_identity_status: Optional[SpeakerVerificationResult] - Layer 2's
  output, or None if no speaker_id was claimed/enrolled for this call.
- context_result: ContextEvaluationResult - Layer 3's rule-based
  assessment of non-voice risk signals (transaction value, caller
  metadata, timing).
"""
import logging
from typing import Optional

from config.settings import settings
from backend.models.schemas import (
    TrustScoreResult,
    SpeakerVerificationResult,
    ContextEvaluationResult,
)

logger = logging.getLogger("VoiceDetector.TrustScoreEngine")


def compute_trust_score(
    ai_probability: float,
    speaker_result: Optional[SpeakerVerificationResult],
    context_result: ContextEvaluationResult,
    ai_threshold: float = settings.AI_THRESHOLD,
    has_speaker_input: Optional[bool] = None,
    has_context_input: Optional[bool] = None,
) -> TrustScoreResult:
    """
    Computes unified final trust score using the 3-model weighted formula:
      - 40% Weight: AI Generated or Not (Voice Deepfake Detection)
      - 30% Weight: Identity Matching or Not (Biometric Voiceprint Verification)
      - 30% Weight: Context Safe or Not (Transaction & Metadata Context Safety)

    Formula:
      Final Trust Score (0-100) = (0.40 * S_ai) + (0.30 * S_id) + (0.30 * S_ctx)

    If no input is given for speaker identity or conversation context, the score
    for that component is set to 0, requiring step-up verification for an updated score.
    """
    if has_speaker_input is None:
        has_speaker_input = speaker_result is not None

    if has_context_input is None:
        has_context_input = False

    # 1. AI Authenticity Score (0 to 100) - 40% Weight
    # High = Authentic Human, Low = AI Deepfake
    ai_auth_score = round(max(0.0, min(100.0, (1.0 - ai_probability) * 100.0)), 1)
    voice_ok = ai_probability < ai_threshold

    # 2. Identity Match Score (0 to 100) - 30% Weight
    if not has_speaker_input:
        identity_match_score = 0.0
        identity_status = "NOT_PROVIDED"
    elif speaker_result is not None:
        raw_sim = speaker_result.similarity_score if speaker_result.similarity_score is not None else (0.85 if speaker_result.verified else 0.25)
        # Convert to 0-100 scale
        if speaker_result.verified:
            identity_match_score = round(max(70.0, min(99.0, raw_sim * 100.0 if raw_sim <= 1.0 else raw_sim)), 1)
            identity_status = "VERIFIED"
        else:
            identity_match_score = round(max(5.0, min(45.0, raw_sim * 100.0 if raw_sim <= 1.0 else raw_sim)), 1)
            identity_status = "MISMATCH"
    else:
        identity_match_score = 0.0
        identity_status = "NOT_PROVIDED"

    # 3. Context Safe Score (0 to 100) - 30% Weight
    if not has_context_input:
        context_safe_score = 0.0
        context_status = "NOT_PROVIDED"
        context_flagged = False
    else:
        context_flagged = context_result.action_risk != "LOW_RISK"
        if not context_flagged:
            context_safe_score = 100.0
            context_status = "CLEAR"
        else:
            context_safe_score = 25.0
            context_status = "; ".join(context_result.risk_reasons) if context_result.risk_reasons else "ANOMALY_FLAGGED"

    # Final 3-Model Weighted Formula
    raw_trust_100 = (0.40 * ai_auth_score) + (0.30 * identity_match_score) + (0.30 * context_safe_score)
    final_trust_100 = round(max(0.0, min(100.0, raw_trust_100)), 1)
    trust_score_norm = round(final_trust_100 / 100.0, 4)

    has_missing_inputs = (not has_speaker_input) or (not has_context_input)

    # Decision Categorization
    if not voice_ok:
        decision = "AI_GENERATED_BLOCK"
    elif identity_status == "MISMATCH":
        decision = "IDENTITY_MISMATCH_BLOCK"
    elif has_missing_inputs or context_flagged or final_trust_100 < 80.0:
        decision = "STEP_UP_VERIFICATION_REQUIRED"
    else:
        decision = "VERIFIED_LOW_RISK"

    logger.info(
        f"Trust score: {final_trust_100}/100 (AI={ai_auth_score}, ID={identity_match_score}, CTX={context_safe_score}) -> {decision}"
    )

    return TrustScoreResult(
        trust_score=trust_score_norm,
        decision=decision,
        voice_authenticity=round(1.0 - ai_probability, 4),
        ai_authenticity_score=ai_auth_score,
        identity_match_score=identity_match_score,
        context_safe_score=context_safe_score,
        speaker_identity_status=identity_status,
        context_status=context_status,
        formula="Final Trust Score = (0.40 * AI Authenticity) + (0.30 * Identity Match) + (0.30 * Context Safe)"
    )
