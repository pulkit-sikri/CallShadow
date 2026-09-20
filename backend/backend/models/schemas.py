from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = "ok"
    model_name: str
    model_version: str
    is_demo_mode: bool
    sample_rate: int
    threshold: float
    message: Optional[str] = None

class ExplainabilityFlags(BaseModel):
    pitch_monotonicity: bool = False
    spectral_anomaly: bool = False
    energy_flatness_anomaly: bool = False
    details: str

class ChunkPredictionSchema(BaseModel):
    chunk_index: int
    start_time: float
    end_time: float
    ai_probability: float
    human_probability: float
    classification: str
    confidence: float
    features: Dict[str, float] = Field(default_factory=dict)
    is_demo_mode: bool

class SpeakerVerificationResult(BaseModel):
    verified: bool
    similarity_score: Optional[float] = None
    registered_speaker_id: str
    message: str

class ContextDataSchema(BaseModel):
    claimed_identity: Optional[str] = None
    caller_metadata: Optional[Dict[str, Any]] = None
    transaction_value: Optional[float] = None
    time_location_context: Optional[str] = None

class ContextEvaluationResult(BaseModel):
    context_consistency: Optional[float] = None
    behavioral_consistency: Optional[float] = None
    action_risk: str = "UNKNOWN"
    risk_reasons: List[str] = []

class TrustScoreResult(BaseModel):
    trust_score: Optional[float] = None  # 0.0 to 1.0 (or 0-100)
    decision: str = "PENDING_COMPLETE_ENGINE"
    voice_authenticity: float
    ai_authenticity_score: float = 100.0   # 0 to 100 (40% weight)
    identity_match_score: float = 100.0    # 0 to 100 (30% weight)
    context_safe_score: float = 100.0      # 0 to 100 (30% weight)
    speaker_identity_status: str = "NOT_IMPLEMENTED"
    context_status: str = "NOT_IMPLEMENTED"
    formula: str = "Final Trust Score = (0.40 * AI Authenticity) + (0.30 * Identity Match) + (0.30 * Context Safe)"

class UploadResponse(BaseModel):
    filename: str
    duration_seconds: float
    overall_classification: str
    ai_probability: float
    human_probability: float
    mean_ai_probability: float
    median_ai_probability: float
    max_ai_probability: float
    overall_confidence: float
    chunk_count: int
    explainability: ExplainabilityFlags
    chunks: List[ChunkPredictionSchema]
    is_demo_mode: bool
    trust_score: Optional[TrustScoreResult] = None

class LiveClientHandshake(BaseModel):
    sample_rate: int = 44100
    chunk_duration: float = 3.0
    speaker_id: Optional[str] = None
    context_data: Optional[ContextDataSchema] = None

class LiveChunkEvent(BaseModel):
    type: str = "chunk_result"
    chunk_index: int
    ai_probability: float
    human_probability: float
    classification: str
    confidence: float
    is_demo_mode: bool

class LiveSessionSummary(BaseModel):
    type: str = "session_summary"
    total_chunks: int
    total_duration_seconds: float
    overall_classification: str
    mean_ai_probability: float
    median_ai_probability: float
    max_ai_probability: float
    overall_confidence: float
    explainability: ExplainabilityFlags
    is_demo_mode: bool
    trust_score: Optional[TrustScoreResult] = None

# ============================================================================
# Authentication Schemas
# ============================================================================
class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

class UserLoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    created_at: Optional[str] = None

class AuthResponse(BaseModel):
    user: UserResponse
    token: str
    message: str = "Authentication successful"

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

class MessageResponse(BaseModel):
    message: str
    status: str = "ok"