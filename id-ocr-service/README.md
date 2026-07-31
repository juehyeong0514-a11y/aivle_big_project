# 신분증 OCR 서비스

이 서비스는 학습된 `models/best.pt`를 변환한 `models/best.onnx`로 사진에서 신분증을 찾고, PaddleOCR로 이름과 주민번호 앞 6자리(`YYMMDD`)를 읽습니다. 운영 서버에서는 OpenCV DNN으로 ONNX 모델을 실행하므로 PyTorch와 Ultralytics를 설치하지 않습니다. 원본 이미지, 신분증 자른 이미지, OCR 전체 문자열은 파일이나 데이터베이스에 저장하지 않습니다.

## 실행

```bash
cd id-ocr-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 기존 백엔드 연결

OCR 서비스를 Render에 별도 Web Service로 배포한 뒤 기존 `aivle_backend` 환경 변수에 아래 값을 등록합니다.

```text
ID_CARD_OCR_URL=https://새-ocr-서비스.onrender.com
ID_CARD_OCR_API_KEY=OCR-서비스의-ID_CARD_SERVICE_TOKEN과-같은-값
```

OCR 서비스의 `ID_CARD_SERVICE_TOKEN`도 반드시 등록합니다. 이 값이 비어 있으면 외부 인증 없이 OCR API가 열립니다.

배포 직후에는 OCR 모델을 백그라운드에서 준비합니다. `https://새-ocr-서비스.onrender.com/health`가 `{ "status": "ready" }`를 반환한 뒤 신분증 촬영을 테스트하세요. 준비 중에는 `{ "status": "warming" }`가 반환됩니다.

## 인증 기준

1. YOLO가 신분증을 찾습니다.
2. OCR이 신분증에서 이름과 생년월일을 읽습니다.
3. 기존 Node 백엔드가 등록된 이름과 생년월일 모두를 비교합니다.
4. 둘 다 일치할 때만 신원확인 완료입니다.
5. 이름·생년월일 비교 결과만 남기고 이미지와 OCR 값은 즉시 폐기합니다.
