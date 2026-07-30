from __future__ import annotations

import base64
import binascii
import json
import os
import re
from dataclasses import dataclass
from typing import Final

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException, status
from paddleocr import PaddleOCR
from pydantic import BaseModel, ConfigDict, Field
from ultralytics import YOLO

MAX_IMAGE_BYTES: Final[int] = 3_500_000
MIN_YOLO_CONFIDENCE: Final[float] = 0.75
DATE_PATTERN: Final[re.Pattern[str]] = re.compile(r"(?<!\d)(\d{2})[.\-/\s]?(\d{2})[.\-/\s]?(\d{2})(?!\d)")


class OCRRequest(BaseModel):
    model_config = ConfigDict(frozen=True)
    image: str = Field(min_length=32, max_length=5_000_000)
    expectedName: str = Field(min_length=2, max_length=100)


class OCRResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    residentNumberFront: str = Field(pattern=r"^\d{6}$")
    nameMatched: bool


@dataclass(frozen=True, slots=True)
class DetectedCard:
    image: np.ndarray


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
        model_path = os.environ.get("ID_CARD_YOLO_MODEL_PATH", "models/best.pt")
        if not os.path.isfile(model_path):
            raise RuntimeError(f"YOLO 모델 파일을 찾을 수 없습니다: {model_path}")
        self._detector = YOLO(model_path)
        self._ocr = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="korean_PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )

    def detect_card(self, image: np.ndarray) -> DetectedCard:
        prediction = self._detector(image, conf=MIN_YOLO_CONFIDENCE, verbose=False)[0]
        if prediction.boxes is None or len(prediction.boxes) == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증을 찾지 못했습니다. 신분증 전체가 화면에 보이도록 다시 촬영해주세요.")
        index = int(prediction.boxes.conf.argmax().item())
        x1, y1, x2, y2 = (int(value) for value in prediction.boxes.xyxy[index].tolist())
        height, width = image.shape[:2]
        crop = image[max(y1, 0):min(y2, height), max(x1, 0):min(x2, width)]
        if crop.size == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증 영역을 자르지 못했습니다. 다시 촬영해주세요.")
        return DetectedCard(image=crop)

    def recognize_identity(self, card: DetectedCard, expected_name: str) -> RecognizedIdentity:
        recognized_text = " ".join(extract_text(result) for result in self._ocr.predict(card.image))
        matched = DATE_PATTERN.search(recognized_text)
        if matched is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="신분증에서 생년월일을 읽지 못했습니다. 빛 반사를 피해서 다시 촬영해주세요.")
        return RecognizedIdentity(
            resident_number_front="".join(matched.groups()),
            name_matched=normalize_name(expected_name) in normalize_name(recognized_text),
        )


service = IdentityOCRService()
app = FastAPI(title="Aivle ID OCR", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr/id-card", response_model=OCRResponse)
def recognize_id_card(payload: OCRRequest, authorization: str | None = Header(default=None)) -> OCRResponse:
    expected_token = os.environ.get("ID_CARD_SERVICE_TOKEN")
    if expected_token and authorization != f"Bearer {expected_token}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OCR 서비스 인증에 실패했습니다.")
    card = service.detect_card(decode_data_url(payload.image))
    identity = service.recognize_identity(card, payload.expectedName)
    return OCRResponse(residentNumberFront=identity.resident_number_front, nameMatched=identity.name_matched)
