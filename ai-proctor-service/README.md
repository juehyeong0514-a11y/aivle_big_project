# AI 감독 서비스

웹캠 정지 화면을 경량 범용 YOLO 모델로 분석하는 독립 FastAPI 서비스입니다. 사람 수, 휴대전화, 선택적으로 책을 탐지하며 원본 이미지나 base64 문자열을 파일·DB·로그에 저장하지 않습니다.

## 실행

가중치 파일은 Git에 넣지 말고 배포 플랫폼의 비밀 파일 또는 영구 볼륨으로 공급합니다.

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

`.env.example`의 환경변수를 등록하고 `/health`가 `ready`인지 확인합니다. API 키가 설정되면 Express의 `AI_PROCTOR_API_KEY`와 같은 값을 사용해야 합니다. `POST /detect`는 JPEG/PNG data URL과 `examId`, `candidateId`를 받습니다.

연속 감지와 경고 쿨다운은 Python이 아니라 Express가 관리합니다. 이 서비스의 이벤트는 감독자 검토 보조 신호이며 자동 실격이나 시험 종료에 사용되지 않습니다.

Render CPU 추론을 위해 입력 크기는 320으로 고정하고 COCO의 사람, 휴대전화, 책 클래스만 처리합니다. 요청이 추론보다 빠르게 들어오면 Express가 중간 프레임을 쌓지 않고 최신 대기 프레임 하나만 유지합니다.

