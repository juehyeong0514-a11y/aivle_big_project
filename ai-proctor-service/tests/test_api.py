import base64
import io

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

import main


class FakeDetector:
    model_name = "fake-yolo.onnx"

    def __init__(self, detections=None, error=None):
        self.detections = detections or []
        self.error = error

    def predict(self, _image, _confidence):
        if self.error:
            raise self.error
        return self.detections


class FakeNet:
    """cv2.dnn 네트워크를 대신해 고정된 YOLO11 스타일 출력을 돌려줍니다."""

    def __init__(self, output):
        self.output = output

    def setInput(self, _blob):
        return None

    def forward(self):
        return self.output


def data_url(size=(16, 16)):
    output = io.BytesIO()
    Image.new("RGB", size, "white").save(output, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode()


def set_detector(value):
    main.detector = value
    main.detector_error = None
    main.detector_warming = False


def build_onnx_detector(anchors):
    """(1, 84, N) 출력을 내보내는 가짜 네트워크를 붙인 OnnxDetector를 만듭니다."""
    num_anchors = 2100
    output = np.zeros((1, 84, num_anchors), dtype=np.float32)
    for index, (box, class_id, score) in enumerate(anchors):
        output[0, :4, index] = box
        output[0, 4 + class_id, index] = score
    detector = object.__new__(main.OnnxDetector)
    detector.model_name = "fake-yolo.onnx"
    detector.model_path = "fake-yolo.onnx"
    detector.net = FakeNet(output)
    return detector


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


def test_letterbox_keeps_aspect_ratio_and_centers_padding():
    padded, scale, pad_x, pad_y = main.letterbox(np.zeros((480, 640, 3), dtype=np.uint8), 320)
    assert padded.shape == (320, 320, 3)
    assert scale == 0.5 and pad_x == 0 and pad_y == 40


def test_onnx_postprocess_filters_classes_and_removes_duplicates():
    detector = build_onnx_detector([
        ([160, 160, 100, 200], 0, 0.90),   # person
        ([162, 158, 100, 200], 0, 0.80),   # 겹치는 person 중복 -> NMS 제거
        ([40, 160, 60, 180], 0, 0.75),     # 떨어진 person -> 유지
        ([240, 100, 40, 60], 67, 0.85),    # cell phone
        ([100, 100, 50, 50], 56, 0.95),    # chair -> 대상 클래스 아님
        ([280, 280, 30, 30], 0, 0.30),     # 임계값 미만 person
    ])
    detections = detector.predict(Image.new("RGB", (640, 480), "white"), 0.55)
    labels = [item["label"] for item in detections]
    assert len(detections) == 3
    assert labels.count("person") == 2 and labels.count("cell phone") == 1

    person_count, events = main.make_events(detections, book_enabled=False)
    assert person_count == 2
    assert {event.type for event in events} == {"MULTIPLE_PEOPLE", "CELL_PHONE_DETECTED"}


def test_onnx_postprocess_restores_original_coordinates():
    detector = build_onnx_detector([([160, 160, 100, 200], 0, 0.90)])
    bbox = detector.predict(Image.new("RGB", (640, 480), "white"), 0.55)[0]["bbox"]
    # scale=0.5, pad_y=40 이므로 원본 기준 (220, 40) ~ (420, 440)
    assert np.allclose(bbox, [220 / 640, 40 / 480, 420 / 640, 440 / 480], atol=1e-3)
