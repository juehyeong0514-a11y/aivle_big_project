from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
from dataclasses import dataclass
from threading import Lock, Thread
from typing import Final

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

MAX_IMAGE_BYTES: Final[int] = 3_500_000
MIN_YOLO_CONFIDENCE: Final[float] = 0.75
YOLO_INPUT_SIZE: Final[int] = 640
DATE_PATTERN: Final[re.Pattern[str]] = re.compile(r"(?<!\d)(\d{2})[.\-/\s]?(\d{2})[.\-/\s]?(\d{2})(?!\d)")


class OCRRequest(BaseModel):
    model_config = ConfigDict(frozen=True)
    image: str = Field(min_length=32, max_length=5_000_000)
    expectedName: str = Field(min_length=2, max_length=100)


class OCRResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    residentNumberFront: str = Field(pattern=r"^\d{6}$")
    nameMatched: bool


class CardDetectionRequest(BaseModel):
    model_config = ConfigDict(frozen=True)
    image: str = Field(min_length=32, max_length=5_000_000)


class CardDetectionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    aligned: bool


@dataclass(frozen=True, slots=True)
class DetectedCard:
    image: np.ndarray
    aligned: bool


@dataclass(frozen=True, slots=True)
class RecognizedIdentity:
    resident_number_front: str
    name_matched: bool


def decode_data_url(value: str) -> np.ndarray:
    prefix, separator, encoded = value.partition(",")
    if not separator or not prefix.startswith("data:image/") or ";base64" not in prefix:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미지 데이터 형식이 올바르지 않습니다.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except binascii.Error as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미지 데이터를 읽을 수 없습니다.") from error
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="신분증 사진의 용량이 너무 큽니다.")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="신분증 사진을 해석할 수 없습니다.")
    return image


def extract_text(result: object) -> str:
    serialized = result.json if isinstance(result.json, str) else json.dumps(result.json, ensure_ascii=False)
    payload = json.loads(serialized)
    texts = payload.get("rec_texts", payload.get("res", {}).get("rec_texts", []))
    return " ".join(text for text in texts if isinstance(text, str))


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()


class IdentityOCRService:
    def __init__(self) -> None:
        from paddleocr import PaddleOCR

        configured_model_path = os.environ.get("ID_CARD_YOLO_MODEL_PATH", "models/best.onnx")
        model_path = (
            f"{configured_model_path[:-3]}.onnx"
            if configured_model_path.lower().endswith(".pt")
            else configured_model_path
        )
        if not os.path.isfile(model_path):
            raise RuntimeError(f"YOLO 모델 파일을 찾을 수 없습니다: {model_path}")
        self._detector = cv2.dnn.readNetFromONNX(model_path)
        self._ocr = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="korean_PP-OCRv5_mobile_rec",
            text_recognition_batch_size=1,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
            engine="onnxruntime",
            enable_mkldnn=False,
            cpu_threads=1,
        )

    def detect_card(self, image: np.ndarray) -> DetectedCard:
        blob = cv2.dnn.blobFromImage(image, scalefactor=1 / 255, size=(YOLO_INPUT_SIZE, YOLO_INPUT_SIZE), swapRB=True, crop=False)
        self._detector.setInput(blob)
        prediction = np.squeeze(self._detector.forward())
        if prediction.ndim != 2:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증 인식 결과를 해석하지 못했습니다. 다시 촬영해주세요.")
        candidates = prediction.T if prediction.shape[0] < prediction.shape[1] else prediction
        class_scores = candidates[:, 4:]
        if class_scores.shape[1] == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증 인식 결과를 해석하지 못했습니다. 다시 촬영해주세요.")
        confidences = class_scores.max(axis=1)
        index = int(np.argmax(confidences))
        if float(confidences[index]) < MIN_YOLO_CONFIDENCE:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증을 찾지 못했습니다. 신분증 전체가 화면에 보이도록 다시 촬영해주세요.")
        height, width = image.shape[:2]
        center_x, center_y, box_width, box_height = candidates[index, :4]
        scale_x = width / YOLO_INPUT_SIZE
        scale_y = height / YOLO_INPUT_SIZE
        x1 = int((center_x - box_width / 2) * scale_x)
        y1 = int((center_y - box_height / 2) * scale_y)
        x2 = int((center_x + box_width / 2) * scale_x)
        y2 = int((center_y + box_height / 2) * scale_y)
        crop = image[max(y1, 0):min(y2, height), max(x1, 0):min(x2, width)]
        if crop.size == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증 영역을 자르지 못했습니다. 다시 촬영해주세요.")
        center_x = (x1 + x2) / (2 * width)
        center_y = (y1 + y2) / (2 * height)
        card_width = (x2 - x1) / width
        card_height = (y2 - y1) / height
        aligned = abs(center_x - 0.5) <= 0.18 and abs(center_y - 0.5) <= 0.18 and 0.32 <= card_width <= 0.92 and 0.12 <= card_height <= 0.7
        return DetectedCard(image=crop, aligned=aligned)

    def recognize_identity(self, card: DetectedCard, expected_name: str) -> RecognizedIdentity:
        recognized_text = " ".join(extract_text(result) for result in self._ocr.predict(card.image))
        matched = DATE_PATTERN.search(recognized_text)
        if matched is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증에서 생년월일을 읽지 못했습니다. 빛 반사를 피해서 다시 촬영해주세요.")
        return RecognizedIdentity(
            resident_number_front="".join(matched.groups()),
            name_matched=normalize_name(expected_name) in normalize_name(recognized_text),
        )


service: IdentityOCRService | None = None
service_error: str | None = None
service_warming = False
service_lock = Lock()
inference_lock = Lock()
app = FastAPI(title="Aivle ID OCR", version="0.1.0")
logger = logging.getLogger("aivle-id-ocr")


def warm_ocr_service() -> None:
    global service, service_error, service_warming
    try:
        initialized_service = IdentityOCRService()
    except (ImportError, OSError, RuntimeError, ValueError) as error:
        logger.exception("신분증 OCR 모델 준비에 실패했습니다.")
        with service_lock:
            service_error = str(error)
            service_warming = False
        return
    with service_lock:
        service = initialized_service
        service_error = None
        service_warming = False
    logger.info("신분증 OCR 모델 준비가 완료되었습니다.")


def start_ocr_service_warmup() -> None:
    global service_warming
    with service_lock:
        if service is not None or service_warming:
            return
        service_warming = True
    Thread(target=warm_ocr_service, name="id-card-ocr-warmup", daemon=True).start()


def get_service() -> IdentityOCRService:
    with service_lock:
        initialized_service = service
        initialization_error = service_error
    if initialized_service is not None:
        return initialized_service
    if initialization_error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="신분증 OCR 모델 준비에 실패했습니다. OCR 서비스 로그를 확인한 뒤 다시 배포해주세요.")
    start_ocr_service_warmup()
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="신분증 OCR 모델을 준비하고 있습니다. 1~2분 후 다시 촬영해주세요.")


def require_service_token(authorization: str | None) -> None:
    expected_token = os.environ.get("ID_CARD_SERVICE_TOKEN")
    if expected_token and authorization != f"Bearer {expected_token}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OCR 서비스 인증에 실패했습니다.")


@app.get("/health")
def health() -> dict[str, str]:
    with service_lock:
        initialized_service = service
        initialization_error = service_error
    if initialized_service is not None:
        return {"status": "ready"}
    if initialization_error:
        return {"status": "error"}
    return {"status": "warming"}


@app.on_event("startup")
def warm_ocr_models() -> None:
    start_ocr_service_warmup()


@app.post("/ocr/id-card/detect", response_model=CardDetectionResponse)
def detect_id_card(payload: CardDetectionRequest, authorization: str | None = Header(default=None)) -> CardDetectionResponse:
    require_service_token(authorization)
    with inference_lock:
        try:
            card = get_service().detect_card(decode_data_url(payload.image))
        except HTTPException as error:
            if error.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
                return CardDetectionResponse(aligned=False)
            raise
    return CardDetectionResponse(aligned=card.aligned)


@app.post("/ocr/id-card", response_model=OCRResponse)
def recognize_id_card(payload: OCRRequest, authorization: str | None = Header(default=None)) -> OCRResponse:
    require_service_token(authorization)
    with inference_lock:
        ocr_service = get_service()
        card = ocr_service.detect_card(decode_data_url(payload.image))
        identity = ocr_service.recognize_identity(card, payload.expectedName)
    return OCRResponse(residentNumberFront=identity.resident_number_front, nameMatched=identity.name_matched)
