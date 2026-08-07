from pydantic import BaseModel, Field


class FrameRequest(BaseModel):
    """A webcam frame sent by the Node backend (base64, optionally data-URL)."""

    image: str = Field(..., min_length=100, max_length=8_000_000)


class FaceResult(BaseModel):
    """Normalised result of analysing a single frame."""

    faceStatus: str
    faceCount: int = 0
    confidence: float = 0.0
    multipleFaces: bool = False
    lookingAway: bool = False
    remark: str = ""


class ValidateResponse(BaseModel):
    ok: bool
    message: str
    width: int = 0
    height: int = 0
    channels: int = 0
    bytes_: int = 0
