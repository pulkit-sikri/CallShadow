import os
import logging
from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config.settings import settings
from backend.models.database import init_db
from backend.ml.factory import get_voice_detector
from backend.api.rest_routes import router as rest_router
from backend.api.websocket_routes import router as ws_router
from backend.api.auth_routes import router as auth_router, limiter
from backend.api.report_routes import router as report_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("VoiceDetector.Main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    # Initialize SQLite database
    init_db()
    # Trigger model factory check on startup (logs loud warning if fallback)
    detector = get_voice_detector()
    if detector.is_demo_mode:
        logger.warning("Running in Demo Mode Fallback. Surface flag 'is_demo_mode' = True.")
    else:
        logger.info(f"Trained model '{detector.model_name}' successfully initialized.")
    
    # Pre-warm speaker verifier in background/startup so user analysis doesn't wait
    try:
        from backend.services.real_speaker_verifier import real_speaker_verifier
        if real_speaker_verifier._ready:
            logger.info("Speaker verification subsystem initialized & ready.")
    except Exception as spk_err:
        logger.warning(f"Speaker verifier warm-up notice: {spk_err}")
    
    yield


# Create FastAPI application with lifespan
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Voice Deepfake Detector - Fine-tuned Wav2Vec2 Classifier API",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Attach slowapi rate limiter to app state and register exception handler
app.state.limiter = limiter

async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again in a few moments."}
    )

app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content-Security-Policy designed for CallShadow Web Dashboard, AudioWorklet, and WebSockets
        csp_directives = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; "
            "img-src 'self' data: blob:; "
            "worker-src 'self' blob:; "
            "media-src 'self' blob: data:; "
            "connect-src 'self' ws: wss: http: https:;"
        )
        response.headers["Content-Security-Policy"] = csp_directives
        return response

app.add_middleware(SecurityHeadersMiddleware)


# CORS middleware with strict allowed origins from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router)
app.include_router(report_router)
app.include_router(rest_router)
app.include_router(ws_router)

# Locate frontend directory (checks ./frontend and ../web)
backend_root = os.path.dirname(__file__)
candidates = [
    os.path.join(backend_root, "frontend"),
    os.path.abspath(os.path.join(backend_root, "..", "web")),
    os.path.join(backend_root, "web")
]

frontend_dir = candidates[0]
for c in candidates:
    if os.path.exists(c) and os.path.exists(os.path.join(c, "index.html")):
        frontend_dir = c
        break

if os.path.exists(frontend_dir):
    js_dir = os.path.join(frontend_dir, "js")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/styles.css")
def serve_styles():
    css_path = os.path.join(frontend_dir, "styles.css")
    if os.path.exists(css_path):
        return FileResponse(
            css_path,
            media_type="text/css",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {"error": "styles.css not found"}

@app.get("/")
def serve_index():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(
            index_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {"message": "AI Voice Deepfake Detector API operational. Frontend file index.html not found."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
