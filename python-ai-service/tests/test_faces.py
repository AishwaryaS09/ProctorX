"""Tests for the Python AI service endpoints (FastAPI TestClient)."""
import base64

import cv2
import numpy as np
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def _b64(frame):
    ok, buf = cv2.imencode(".jpg", frame)
    assert ok
    return base64.b64encode(buf.tobytes()).decode()


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_blank_frame_reports_absent():
    blank = np.zeros((240, 320, 3), np.uint8)
    r = client.post("/api/ai/analyze-frame", json={"image": _b64(blank)})
    assert r.status_code == 200
    body = r.json()
    assert body["faceStatus"] == "ABSENT"
    assert body["faceCount"] == 0
    assert body["multipleFaces"] is False


def test_validate_frame():
    blank = np.zeros((240, 320, 3), np.uint8)
    r = client.post("/api/ai/validate-frame", json={"image": _b64(blank)})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["width"] == 320
    assert body["height"] == 240


def test_validate_rejects_garbage():
    r = client.post("/api/ai/validate-frame", json={"image": "not-an-image"})
    assert r.status_code == 422


def test_analyze_rejects_undecodable_long_string():
    # Long enough to pass schema validation but not a valid image.
    garbage = "g" * 200
    r = client.post("/api/ai/analyze-frame", json={"image": garbage})
    assert r.status_code == 200
    assert r.json()["faceStatus"] == "ERROR"
