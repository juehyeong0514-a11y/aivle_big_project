# AI 감독 서비스

웹캠 정지 화면을 경량 YOLO 모델로 분석하는 독립 FastAPI 서비스입니다. 사람 수, 휴대전화, 선택적으로 책을 탐지하며 원본 이미지나 base64 문자열을 파일·DB·로그에 저장하지 않습니다.

추론은 `ultralytics`/`torch` 대신 **OpenCV DNN(`cv2.dnn.readNetFromONNX`)** 으로 ONNX 모델을 직접 실행합니다. torch를 로드하지 않으므로 512MB 인스턴스에서도 메모리 초과 없이 동작합니다. 같은 프로젝트의 `id-ocr-service`와 동일한 방식입니다.

## 모델 준비

배포 전에 `yolo11n.pt`를 한 번 ONNX로 변환해서 `yolo11n.onnx`를 만들고 커밋합니다. 변환에만 `ultralytics`가 필요하며, 서비스 실행에는 필요하지 않습니다.

```bash
python -m pip install ultralytics onnx onnxslim
python export_onnx.py
```

변환 시 입력 크기는 `main.py`의 `YOLO_INPUT_SIZE`(320)와 반드시 같아야 합니다.

## 실행

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

`.env.example`의 환경변수를 등록하고 `/health`가 `ready`인지 확인합니다. API 키가 설정되면 Express의 `AI_PROCTOR_API_KEY`와 같은 값을 사용해야 합니다. `POST /detect`는 JPEG/PNG data URL과 `examId`, `candidateId`를 받습니다.

`AI_PROCTOR_MODEL_PATH`에 `.pt` 경로가 들어와도 같은 이름의 `.onnx` 파일을 찾아 로드하므로 기존 배포 설정을 그대로 두어도 동작합니다.

## 메모리 사용량 관리

512MB 인스턴스를 기준으로 다음을 적용합니다.

- `ultralytics`/`torch` 의존성 제거, `opencv-python-headless`만 사용
- 추론 입력 크기 320 고정, COCO의 사람·휴대전화·책 클래스만 후처리
- `cv2.setNumThreads(1)`과 `OMP_NUM_THREADS=1`로 스레드별 작업 버퍼 확산 방지
- 요청이 추론보다 빠르게 들어오면 Express가 중간 프레임을 쌓지 않고 최신 대기 프레임 하나만 유지

## 동작 방식

연속 감지와 경고 쿨다운은 Python이 아니라 Express가 관리합니다. 이 서비스의 이벤트는 감독자 검토 보조 신호이며 자동 실격이나 시험 종료에 사용되지 않습니다.

전처리는 비율을 유지하는 레터박스 방식이고, 후처리에서 클래스별 NMS(IoU 0.45)를 적용한 뒤 좌표를 원본 이미지 기준 0~1 비율로 되돌려 반환합니다.

## 테스트

```bash
python -m pytest tests
```

가짜 네트워크로 클래스 필터, NMS 중복 제거, 레터박스 좌표 역변환, 이벤트 생성을 검증하므로 ONNX 파일 없이도 실행할 수 있습니다.
