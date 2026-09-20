"""
Context Engine Interface Module.
Prepares the interface for future context analysis, caller metadata validation, and action risk assessment.
"""
from typing import Dict, Any, Optional

from backend.models.schemas import ContextDataSchema, ContextEvaluationResult


class ContextEngineInterface:
    """
    Interface for context risk evaluation (caller metadata, location, transaction value, behavior).

    Rule-based by design, not ML - real fraud-risk systems commonly combine
    a handful of weighted rules into a threshold decision rather than a
    trained classifier for this layer, since the signals here (transaction
    value, contact status, timing) are simple, auditable, and don't need
    learned pattern recognition to be useful.
    """

    @staticmethod
    def evaluate_context(context_data: ContextDataSchema) -> ContextEvaluationResult:
        """
        Evaluates caller context for risk indicators.
        Returns ContextEvaluationResult.
        """
        reasons = []

        # Rule 1: high-value transaction requires step-up auth
        if context_data.transaction_value and context_data.transaction_value > 10000:
            reasons.append("High-value transaction request exceeding threshold ($10,000) requiring step-up authentication.")

        # Rule 2: caller metadata flags (e.g. from a telecom/carrier signal)
        if context_data.caller_metadata:
            if context_data.caller_metadata.get("is_spoofed_caller_id") is True:
                reasons.append("Caller ID has been flagged as spoofed by upstream carrier signal.")
            if context_data.caller_metadata.get("is_known_contact") is False:
                reasons.append("Caller is not a previously known/registered contact.")
            if context_data.caller_metadata.get("call_frequency_last_24h", 0) > 5:
                reasons.append("Unusually high call frequency from this number in the last 24 hours.")

        # Rule 3: time/location context anomaly (if provided upstream)
        if context_data.time_location_context:
            flagged_context_tags = {"unusual_hour", "unexpected_region", "vpn_detected"}
            if context_data.time_location_context in flagged_context_tags:
                reasons.append(f"Call context flagged: {context_data.time_location_context}.")

        return ContextEvaluationResult(
            context_consistency=None,
            behavioral_consistency=None,
            action_risk="REQUIRES_VERIFICATION" if reasons else "LOW_RISK",
            risk_reasons=reasons,
        )
