"""Central configuration for the Python AI service.

Values are read from environment variables at runtime so nothing is frozen at
import time (mirrors the reference implementation's lazy-config lesson).
"""
import os


def _bool(name, fallback):
    value = os.environ.get(name)
    if value is None:
        return fallback
    return value.lower() in ("1", "true", "yes")


class Config:
    PORT = int(os.environ.get("AI_PORT", "8000"))
    HOST = os.environ.get("AI_HOST", "0.0.0.0")
    MAX_IMAGE_BYTES = int(os.environ.get("AI_MAX_IMAGE_BYTES", "8000000"))
    CORS_ORIGINS = os.environ.get("AI_CORS_ORIGINS", "*").split(",")

    # Face detection tuning (same defaults as the reference project).
    SCALE_FACTOR = float(os.environ.get("AI_SCALE_FACTOR", "1.1"))
    MIN_NEIGHBORS = int(os.environ.get("AI_MIN_NEIGHBORS", "5"))
    MIN_FACE_SIZE = int(os.environ.get("AI_MIN_FACE_SIZE", "30"))

    # "Looking away" deviation thresholds (fraction of frame width/height).
    LOOK_AWAY_X_THRESHOLD = float(os.environ.get("AI_LOOK_AWAY_X_THRESHOLD", "0.35"))
    LOOK_AWAY_Y_THRESHOLD = float(os.environ.get("AI_LOOK_AWAY_Y_THRESHOLD", "0.35"))

    DEBUG = _bool("AI_DEBUG", True)
