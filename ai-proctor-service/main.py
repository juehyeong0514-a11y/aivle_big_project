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

from fastapi import FastAPI, Header, HTTPException, status
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

MAX_IMAGE_BYTES = 2_000_000
MAX_IMAGE_PIXELS = 4_000_000
SUPPORTED_MIME_TYPES = {"image/jpeg", "image/png"}
EVENT_MESSAGES = {
    "NO_PERSON": "화면에서 응시자가 감지되지 않았습니다.",
    "MULTIPLE_PEOPLE": "화면에서 여러 사람이 감지되었습니다.",
    "CELL_PHONE_DETECTED": "화면에서 휴대전화가 감지되었습니다.",
    "BOOK_DETECTED": "화면에서 책으로 추정되는 물체가 감지되었습니다.",
}


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


class YoloDetector:
    def __init__(self, model_path: str):
        from ultralytics import YOLO
        self.model_path = model_path
        self.model_name = Path(model_path).name
        self.model = YOLO(model_path)

    def predict(self, image: Image.Image, confidence: float) -> list[dict]:
        result = self.model.predict(source=image, conf=confidence, verbose=False)[0]
        names = result.names
        width, height = image.size
        detections = []
        for box in result.boxes:
            label = str(names[int(box.cls.item())]).strip().lower()
            if label not in {"person", "cell phone", "book"}:
                continue
            x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
            detections.append({"label": label, "confidence": float(box.conf.item()), "bbox": [max(0, min(1, x1 / width)), max(0, min(1, y1 / height)), max(0, min(1, x2 / width)), max(0, min(1, y2 / height))]})
        return detections


detector = None
detector_error: str | None = None
detector_warming = False
detector_lock = Lock()
inference_lock = Lock()
logger = logging.getLogger("aivle-ai-proctor")
detector_factory: Callable[[str], object] = YoloDetector
app = FastAPI(title="Aivle AI Proctor", version="0.1.0")


def model_path() -> str:
    return os.environ.get("AI_PROCTOR_MODEL_PATH", "models/yolo-model.pt")


def warm_detector() -> None:
    global detector, detector_error, detector_warming
    try:
        initialized = detector_factory(model_path())
    except (ImportError, OSError, RuntimeError, ValueError) as error:
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

