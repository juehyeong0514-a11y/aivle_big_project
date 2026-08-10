from __future__ import annotations

import base64
import binascii
import io
import logging
import os
import time
from pathlib import Path
from threading import Lock, Thread
from typing import Callable

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException, status
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

MAX_IMAGE_BYTES = 2_000_000
MAX_IMAGE_PIXELS = 4_000_000
SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png"}
YOLO_INPUT_SIZE = 320
MAX_DETECTIONS = 20
NMS_IOU_THRESHOLD = 0.45
# COCO 클래스 인덱스: person, cell phone, book
TARGET_CLASS_LABELS = {0: "person", 67: "cell phone", 73: "book"}
EVENT_MESSAGES = {
    "NO_PERSON": "화면에서 응시자가 감지되지 않았습니다.",
    "MULTIPLE_PEOPLE": "화면에서 여러 사람이 감지되었습니다.",
    "CELL_PHONE_DETECTED": "화면에서 휴대전화가 감지되었습니다.",
    "BOOK_DETECTED": "화면에서 책으로 추정되는 물체가 감지되었습니다.",
}

# 512MB 인스턴스에서 스레드별 작업 버퍼가 메모리를 밀어내지 않도록 단일 스레드로 고정합니다.
cv2.setNumThreads(1)


class DetectionRequest(BaseModel):
    image: str
    examId: str = Field(min_length=1, max_length=200)
    candidateId: str = Field(min_length=1, max_length=200)


class Detection(BaseModel):
    label: str
    confidence: float = Field(ge=0, le=1)
    bbox: list[float]


class DetectionEvent(BaseModel):
    type: str
    confidence: float = Field(ge=0, le=1)
    message: str


class DetectionResponse(BaseModel):
    model: str
    latencyMs: int
    personCount: int
    detections: list[Detection]
    events: list[DetectionEvent]


def env_float(name: str, default: float) -> float:
    try:
        value = float(os.environ.get(name, default))
        return value if 0 <= value <= 1 else default
    except ValueError:
        return default


def decode_image(data_url: str) -> Image.Image:
    if not isinstance(data_url, str) or "," not in data_url:
        raise HTTPException(status_code=422, detail="올바른 이미지 data URL이 필요합니다.")
    header, encoded = data_url.split(",", 1)
    mime_type = header.removeprefix("data:").split(";", 1)[0].lower()
    if mime_type not in SUPPORTED_MIME_TYPES or ";base64" not in header.lower():
        raise HTTPException(status_code=422, detail="JPEG 또는 PNG base64 이미지만 지원합니다.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=422, detail="이미지 base64를 해석할 수 없습니다.") from None
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="이미지 크기가 허용 범위를 벗어났습니다.")
    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=422, detail="유효한 이미지가 아닙니다.") from None
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=422, detail="이미지 해상도가 허용 범위를 벗어났습니다.")
    return image


def letterbox(image: np.ndarray, size: int) -> tuple[np.ndarray, float, int, int]:
    """비율을 유지한 채 정사각형으로 패딩합니다. ultralytics 전처리와 동일한 방식입니다."""
    height, width = image.shape[:2]
    scale = min(size / width, size / height)
    resized_width = max(1, min(size, round(width * scale)))
    resized_height = max(1, min(size, round(height * scale)))
    resized = cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)
    pad_x = (size - resized_width) // 2
    pad_y = (size - resized_height) // 2
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    canvas[pad_y:pad_y + resized_height, pad_x:pad_x + resized_width] = resized
    return canvas, scale, pad_x, pad_y


class OnnxDetector:
    """ultralytics/torch 없이 OpenCV DNN만으로 YOLO ONNX 모델을 실행합니다."""

    def __init__(self, model_path: str):
        resolved = Path(model_path)
        if resolved.suffix.lower() == ".pt":
            resolved = resolved.with_suffix(".onnx")
        if not resolved.is_file():
            raise RuntimeError(f"ONNX 모델 파일을 찾을 수 없습니다: {resolved}")
        self.model_path = str(resolved)
        self.model_name = resolved.name
        self.net = cv2.dnn.readNetFromONNX(self.model_path)
        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

    def predict(self, image: Image.Image, confidence: float) -> list[dict]:
        source = np.asarray(image, dtype=np.uint8)
        height, width = source.shape[:2]
        if height == 0 or width == 0:
            return []

        padded, scale, pad_x, pad_y = letterbox(source, YOLO_INPUT_SIZE)
        # PIL이 이미 RGB이므로 채널 교환은 하지 않습니다.
        blob = cv2.dnn.blobFromImage(padded, scalefactor=1 / 255, size=(YOLO_INPUT_SIZE, YOLO_INPUT_SIZE), swapRB=False, crop=False)
        self.net.setInput(blob)
        raw_output = np.squeeze(self.net.forward())
        if raw_output.ndim != 2:
            return []

        # YOLO11 출력은 (4 + 클래스 수, 앵커 수)이므로 (앵커 수, 4 + 클래스 수)로 전치합니다.
        predictions = raw_output.T if raw_output.shape[0] < raw_output.shape[1] else raw_output
        class_scores = predictions[:, 4:]
        if class_scores.shape[1] == 0:
            return []

        class_ids = class_scores.argmax(axis=1)
        confidences = class_scores[np.arange(class_scores.shape[0]), class_ids]
        keep = (confidences >= confidence) & np.isin(class_ids, list(TARGET_CLASS_LABELS))
        if not keep.any():
            return []

        boxes_xywh = predictions[keep, :4]
        class_ids = class_ids[keep]
        confidences = confidences[keep]

        # 레터박스 좌표를 원본 이미지 좌표로 되돌립니다.
        center_x = (boxes_xywh[:, 0] - pad_x) / scale
        center_y = (boxes_xywh[:, 1] - pad_y) / scale
        box_width = boxes_xywh[:, 2] / scale
        box_height = boxes_xywh[:, 3] / scale
        x1 = center_x - box_width / 2
        y1 = center_y - box_height / 2

        nms_boxes = np.stack([x1, y1, box_width, box_height], axis=1).tolist()
        nms_scores = confidences.astype(float).tolist()

        detections: list[dict] = []
        for class_id in np.unique(class_ids):
            indices = np.flatnonzero(class_ids == class_id)
            selected = cv2.dnn.NMSBoxes([nms_boxes[i] for i in indices], [nms_scores[i] for i in indices], float(confidence), NMS_IOU_THRESHOLD)
            if len(selected) == 0:
                continue
            for offset in np.array(selected).flatten():
                index = int(indices[int(offset)])
                left, top, box_w, box_h = nms_boxes[index]
                detections.append({
                    "label": TARGET_CLASS_LABELS[int(class_id)],
                    "confidence": float(nms_scores[index]),
                    "bbox": [
                        max(0.0, min(1.0, left / width)),
                        max(0.0, min(1.0, top / height)),
                        max(0.0, min(1.0, (left + box_w) / width)),
                        max(0.0, min(1.0, (top + box_h) / height)),
                    ],
                })

        detections.sort(key=lambda item: item["confidence"], reverse=True)
        return detections[:MAX_DETECTIONS]


detector = None
detector_error: str | None = None
detector_warming = False
detector_lock = Lock()
inference_lock = Lock()
logger = logging.getLogger("aivle-ai-proctor")
detector_factory: Callable[[str], object] = OnnxDetector
app = FastAPI(title="Aivle AI Proctor", version="0.2.0")


def model_path() -> str:
    return os.environ.get("AI_PROCTOR_MODEL_PATH", "yolo11n.onnx")


def warm_detector() -> None:
    global detector, detector_error, detector_warming
    try:
        initialized = detector_factory(model_path())
    except (ImportError, OSError, RuntimeError, ValueError, cv2.error) as error:
        logger.exception("AI 감독 모델 준비에 실패했습니다.")
        with detector_lock:
            detector_error = str(error)
            detector_warming = False
        return
    with detector_lock:
        detector = initialized
        detector_error = None
        detector_warming = False


def start_warmup() -> None:
    global detector_warming
    with detector_lock:
        if detector is not None or detector_warming:
            return
        detector_warming = True
    Thread(target=warm_detector, name="ai-proctor-warmup", daemon=True).start()


def require_detector():
    with detector_lock:
        initialized, error = detector, detector_error
    if initialized is not None:
        return initialized
    if error:
        raise HTTPException(status_code=503, detail="AI 감독 모델 준비에 실패했습니다.")
    start_warmup()
    raise HTTPException(status_code=503, detail="AI 감독 모델을 준비하고 있습니다.")


def require_token(authorization: str | None) -> None:
    expected = os.environ.get("AI_PROCTOR_API_KEY", "").strip()
    if expected and authorization != f"Bearer {expected}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="AI 감독 서비스 인증에 실패했습니다.")


def make_events(detections: list[dict], book_enabled: bool) -> tuple[int, list[DetectionEvent]]:
    people = [item for item in detections if item["label"] == "person"]
    event_inputs = []
    if len(people) == 0:
        event_inputs.append(("NO_PERSON", 1.0))
    if len(people) >= 2:
        event_inputs.append(("MULTIPLE_PEOPLE", max(item["confidence"] for item in people)))
    phones = [item for item in detections if item["label"] == "cell phone"]
    if phones:
        event_inputs.append(("CELL_PHONE_DETECTED", max(item["confidence"] for item in phones)))
    books = [item for item in detections if item["label"] == "book"]
    if book_enabled and books:
        event_inputs.append(("BOOK_DETECTED", max(item["confidence"] for item in books)))
    return len(people), [DetectionEvent(type=event_type, confidence=confidence, message=EVENT_MESSAGES[event_type]) for event_type, confidence in event_inputs]


@app.on_event("startup")
def warm_model() -> None:
    start_warmup()


@app.get("/health")
def health() -> dict[str, str]:
    with detector_lock:
        state = "ready" if detector is not None else "error" if detector_error else "warming"
        name = getattr(detector, "model_name", Path(model_path()).name)
    return {"status": state, "model": name}


@app.post("/detect", response_model=DetectionResponse)
def detect(payload: DetectionRequest, authorization: str | None = Header(default=None)) -> DetectionResponse:
    require_token(authorization)
    image = decode_image(payload.image)
    started = time.perf_counter()
    try:
        with inference_lock:
            initialized = require_detector()
            raw_detections = initialized.predict(image, env_float("AI_PROCTOR_CONFIDENCE", 0.55))
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("AI 감독 추론에 실패했습니다.")
        raise HTTPException(status_code=500, detail="AI 감독 추론에 실패했습니다.") from error
    detections = [Detection(**item) for item in raw_detections[:50]]
    person_count, events = make_events(raw_detections, os.environ.get("AI_PROCTOR_BOOK_DETECTION_ENABLED", "false").lower() == "true")
    return DetectionResponse(model=getattr(initialized, "model_name", "configured-model"), latencyMs=round((time.perf_counter() - started) * 1000), personCount=person_count, detections=detections, events=events)
