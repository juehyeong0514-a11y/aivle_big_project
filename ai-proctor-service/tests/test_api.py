import base64
import io

from fastapi.testclient import TestClient
from PIL import Image

import main


class FakeDetector:
    model_name = "fake-yolo.pt"

    def __init__(self, detections=None, error=None):
        self.detections = detections or []
        self.error = error

    def predict(self, _image, _confidence):
        if self.error:
            raise self.error
        return self.detections


def data_url(size=(16, 16)):
    output = io.BytesIO()
    Image.new("RGB", size, "white").save(output, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode()


def set_detector(value):
    main.detector = value
    main.detector_error = None
    main.detector_warming = False


def test_health_and_normal_detection():
    set_detector(FakeDetector([{"label": "person", "confidence": .9, "bbox": [0, 0, 1, 1]}]))
    client = TestClient(main.app)
    assert client.get("/health").json()["status"] == "ready"
    response = client.post("/detect", json={"image": data_url(), "examId": "e", "candidateId": "c"})
    assert response.status_code == 200
    assert response.json()["personCount"] == 1
    assert response.json()["events"] == []


def test_person_phone_and_book_events(monkeypatch):
    set_detector(FakeDetector([
        {"label": "person", "confidence": .8, "bbox": [0, 0, .4, 1]},
        {"label": "person", "confidence": .9, "bbox": [.5, 0, 1, 1]},
        {"label": "cell phone", "confidence": .85, "bbox": [.2, .2, .3, .4]},
        {"label": "book", "confidence": .75, "bbox": [.4, .4, .8, .8]},
    ]))
    client = TestClient(main.app)
    payload = {"image": data_url(), "examId": "e", "candidateId": "c"}
    types = {item["type"] for item in client.post("/detect", json=payload).json()["events"]}
    assert types == {"MULTIPLE_PEOPLE", "CELL_PHONE_DETECTED"}
    monkeypatch.setenv("AI_PROCTOR_BOOK_DETECTION_ENABLED", "true")
    types = {item["type"] for item in client.post("/detect", json=payload).json()["events"]}
    assert "BOOK_DETECTED" in types


def test_no_person_invalid_image_and_auth(monkeypatch):
    set_detector(FakeDetector())
    client = TestClient(main.app)
    payload = {"image": data_url(), "examId": "e", "candidateId": "c"}
    assert client.post("/detect", json=payload).json()["events"][0]["type"] == "NO_PERSON"
    assert client.post("/detect", json={**payload, "image": "data:image/jpeg;base64,bad"}).status_code == 422
    monkeypatch.setenv("AI_PROCTOR_API_KEY", "secret")
    assert client.post("/detect", json=payload).status_code == 401
    assert client.post("/detect", json=payload, headers={"Authorization": "Bearer secret"}).status_code == 200


def test_model_failure_and_inference_failure():
    main.detector = None
    main.detector_error = "load failed"
    client = TestClient(main.app)
    payload = {"image": data_url(), "examId": "e", "candidateId": "c"}
    assert client.post("/detect", json=payload).status_code == 503
    set_detector(FakeDetector(error=RuntimeError("boom")))
    assert client.post("/detect", json=payload).status_code == 500

