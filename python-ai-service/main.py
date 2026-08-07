from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import Config
from routers import faces

app = FastAPI(
    title="ProctorX AI Service",
    description="Isolated computer-vision service (OpenCV). Called only by the Node backend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(faces.router, prefix="/api/ai", tags=["face"])


@app.get("/health")
def health():
    return {"service": "proctorx-ai", "status": "ok"}


@app.get("/")
def root():
    return {
        "service": "proctorx-ai",
        "endpoints": ["/api/ai/detect-face", "/api/ai/analyze-frame", "/api/ai/validate-frame"],
    }
