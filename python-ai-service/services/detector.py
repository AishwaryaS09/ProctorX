"""OpenCV face detection engine.

Pure port of the reference implementation:
* Haar cascade face detection (frontal face default classifier).
* State classification: PRESENT / ABSENT / MULTIPLE / LOOKING_AWAY / ERROR.
* "Looking away" fires when a single face drifts from the frame centre.
"""
import cv2

from config import Config
from utils.decoding import decode_image

_face_cascade = None


def get_face_cascade():
    global _face_cascade
    if _face_cascade is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(cascade_path)
    return _face_cascade


def _confidence_for(boxes, frame_shape):
    """Heuristic confidence from box size relative to the frame area."""
    if not boxes:
        return 0.0
    frame_h, frame_w = frame_shape[:2]
    frame_area = max(frame_w * frame_h, 1)
    best = max(w * h for (x, y, w, h) in boxes)
    relative = best / frame_area
    # Small faces are less confident; webcam-sized faces land near 0.9.
    return round(min(0.99, 0.55 + relative * 1.8), 3)


def analyze_frame_array(frame):
    """Detect faces in an already-decoded frame and classify the state.

    Returns a dict compatible with the Node backend's normaliser.
    """
    if frame is None:
        return {
            "face_status": "ERROR",
            "face_count": 0,
            "confidence": 0.0,
            "multiple_faces": False,
            "looking_away": False,
            "remark": "Could not decode image data",
        }

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = get_face_cascade()
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=Config.SCALE_FACTOR,
        minNeighbors=Config.MIN_NEIGHBORS,
        minSize=(Config.MIN_FACE_SIZE, Config.MIN_FACE_SIZE),
    )
    boxes = [[int(x), int(y), int(w), int(h)] for (x, y, w, h) in faces]
    face_count = len(boxes)
    confidence = _confidence_for(boxes, frame.shape)

    if face_count == 0:
        return {
            "face_status": "ABSENT",
            "face_count": 0,
            "confidence": 0.0,
            "multiple_faces": False,
            "looking_away": False,
            "remark": "No face detected in frame",
        }

    if face_count > 1:
        return {
            "face_status": "MULTIPLE",
            "face_count": face_count,
            "confidence": confidence,
            "multiple_faces": True,
            "looking_away": False,
            "remark": f"{face_count} faces detected",
        }

    x, y, w, h = boxes[0]
    frame_h, frame_w = frame.shape[:2]
    face_cx = x + w / 2.0
    face_cy = y + h / 2.0
    dev_x = abs(face_cx - frame_w / 2.0) / max(frame_w, 1)
    dev_y = abs(face_cy - frame_h / 2.0) / max(frame_h, 1)

    if dev_x > Config.LOOK_AWAY_X_THRESHOLD or dev_y > Config.LOOK_AWAY_Y_THRESHOLD:
        return {
            "face_status": "LOOKING_AWAY",
            "face_count": 1,
            "confidence": confidence,
            "multiple_faces": False,
            "looking_away": True,
            "remark": "Face present but candidate is looking away from screen",
        }

    return {
        "face_status": "PRESENT",
        "face_count": 1,
        "confidence": confidence,
        "multiple_faces": False,
        "looking_away": False,
        "remark": "One face detected",
    }


def analyze_frame(image_data):
    """Backward-compatible entry point: decode base64 then analyze."""
    try:
        frame = decode_image(image_data)
        return analyze_frame_array(frame)
    except Exception as exc:  # pragma: no cover - defensive
        return {
            "face_status": "ERROR",
            "face_count": 0,
            "confidence": 0.0,
            "multiple_faces": False,
            "looking_away": False,
            "remark": f"Face detection error: {exc}",
        }
