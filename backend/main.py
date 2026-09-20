import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from backend.models.database import init_db
from backend.ml.factory import get_voice_detector
from backend.api.rest_routes import router as rest_router
from backend.api.websocket_routes import router as ws_router
from backend.api.auth_routes import router as auth_router
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
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router)
app.include_router(report_router)
app.include_router(rest_router)
app.include_router(ws_router)

# Mount frontend static files
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
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


