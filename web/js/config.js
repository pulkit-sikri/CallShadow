// Voice Security & Authentication Platform - Client Configuration
const CONFIG = {
    APP_NAME: "CallShadow",
    APP_TAGLINE: "Real-Time Voice Biometrics & Deepfake Defense",
    VERSION: "2.5.0-PROD",
    API_BASE_URL: "",
    ENDPOINTS: {
        HEALTH: "/api/health",
        UPLOAD_AUDIO: "/api/audio/upload",
        LIVE_AUDIO: "/api/audio/live",
        SPEAKER_ENROLL: "/api/speaker/enroll",
        AUTH_REGISTER: "/api/auth/register",
        AUTH_LOGIN: "/api/auth/login",
        AUTH_LOGOUT: "/api/auth/logout",
        AUTH_ME: "/api/auth/me",
        AUTH_FORGOT: "/api/auth/forgot-password",
        AUTH_RESET: "/api/auth/reset-password",
        REPORT_PDF: "/api/reports/audit-pdf"
    },
    SUPPORTED_FORMATS: [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"],
    MAX_FILE_SIZE_MB: 50,
    AUDIO: {
        SAMPLE_RATE: 16000,
        BUFFER_SIZE: 4096,
        FFT_SIZE: 512
    },
    STORAGE_KEYS: {
        AUTH_TOKEN: "callshadow_auth_token",
        AUTH_USER: "callshadow_auth_user",
        API_KEYS: "callshadow_api_keys",
        ANALYSIS_HISTORY: "callshadow_history",
        REGISTERED_PROFILES: "callshadow_profiles",
        SETTINGS: "callshadow_settings"
    }
};

window.CONFIG = CONFIG;
