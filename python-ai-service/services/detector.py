"""OpenCV face detection engine.

Pure port of the reference implementation, hardened so a normal candidate is
reliably classified as PRESENT:

* Haar cascade face detection (frontal face default classifier).
* CLAHE contrast enhancement before detection (robust under uneven lighting).
* Two-pass detection: the configured pass, then a relaxed pass that trades a
  little precision to avoid missing a legitimate face.
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


def _prepare_gray(frame):
    """Grayscale + CLAHE. Haar cascades are sensitive to lighting; equalising
    the histogram dramatically improves detection of an ordinary webcam face."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _detect(gray, cascade, scale_factor, min_neighbors, min_size):
    return cascade.detectMultiScale(
        gray,
        scaleFactor=scale_factor,
        minNeighbors=min_neighbors,
        minSize=(min_size, min_size),
    )


def _detect_faces(gray):
    """Two-pass detection.

    The first pass uses the configured (strict) parameters. If nothing is
    found we re-run with relaxed parameters — a lower minNeighbors and a
    smaller minSize — so that a face that is slightly smaller, angled or under
    poor lighting is still detected instead of being reported as ABSENT.
    """
    cascade = get_face_cascade()

    faces = _detect(gray, cascade, Config.SCALE_FACTOR, Config.MIN_NEIGHBORS, Config.MIN_FACE_SIZE)

    if len(faces) == 0:
        faces = _detect(
            gray,
            cascade,
            1.08,
            max(1, Config.MIN_NEIGHBORS - 2),
            max(20, Config.MIN_FACE_SIZE // 2),
        )

    return faces


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

    gray = _prepare_gray(frame)
    faces = _detect_faces(gray)
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
