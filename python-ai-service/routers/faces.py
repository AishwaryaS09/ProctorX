from fastapi import APIRouter, HTTPException

from models.schemas import FaceResult, FrameRequest, ValidateResponse
from services.detector import analyze_frame
from utils.decoding import decode_image

router = APIRouter()


def _to_result(raw):
    return FaceResult(
        faceStatus=raw["face_status"],
        faceCount=raw["face_count"],
        confidence=raw["confidence"],
        multipleFaces=raw["multiple_faces"],
        lookingAway=raw["looking_away"],
        remark=raw["remark"],
    )


@router.post("/detect-face", response_model=FaceResult, tags=["face"])
def detect_face(payload: FrameRequest):
    """Analyze a frame and report the detected face state."""
    return _to_result(analyze_frame(payload.image))


@router.post("/analyze-frame", response_model=FaceResult, tags=["face"])
def analyze_frame_endpoint(payload: FrameRequest):
    """Alias of /detect-face used by the Node monitoring loop."""
    return _to_result(analyze_frame(payload.image))


@router.post("/validate-frame", response_model=ValidateResponse, tags=["face"])
def validate_frame(payload: FrameRequest):
    """Validate that the payload is a decodable image and return dimensions."""
    frame = decode_image(payload.image)
    if frame is None:
        raise HTTPException(status_code=422, detail="Could not decode image data")
    height, width, channels = frame.shape
    return ValidateResponse(
        ok=True,
        message="Valid frame",
        width=width,
        height=height,
        channels=channels,
        bytes_=len(payload.image),
    )
