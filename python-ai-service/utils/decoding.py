"""Base64 / image decoding helpers for the AI service."""
import base64

import cv2
import numpy as np


def strip_data_url(image_data):
    """Remove an optional `data:...;base64,` prefix."""
    if "," in image_data:
        return image_data.split(",", 1)[1]
    return image_data


def decode_image(image_data):
    """Decode a base64 (optionally data-URL prefixed) string into a BGR frame.

    Returns None when decoding fails.
    """
    try:
        img_bytes = base64.b64decode(strip_data_url(image_data), validate=False)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def describe_image(image_data):
    """Return metadata about a frame (or an error message)."""
    frame = decode_image(image_data)
    if frame is None:
        return None, "Could not decode image data"
    height, width, channels = frame.shape
    return frame, None, width, height, channels
