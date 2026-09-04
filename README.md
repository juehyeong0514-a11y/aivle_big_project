# ProctorAI

AI 기반 온라인 역량 평가·감독 플랫폼입니다. 조직별 시험 운영부터 응시자 초대, 신원 확인, PC·모바일 실시간 감독, AI 문제 출제·채점, 결과 발송까지 하나의 흐름으로 제공합니다.

## 핵심 기능

### 관리자

- 매니저 가입 및 조직 승인, 조직별 권한 범위 관리
- 중앙 AI 공급자·모델·API 키와 조직별 사용 한도 설정
- AI 채점 대기열, 호출 로그, 자동 운영 현황 조회
- 초대 보안 정책, 공지사항, 조직 커뮤니티 관리

### 매니저

- 시험 일정·제한 시간, 객관식·코딩 문제, 응시자 관리
- 대화형 AI 출제 도우미와 모범 답안 생성
- 응시자 일괄 등록·배정 및 일회용 초대 링크 발송
- PC 웹캠·모바일 보조 카메라 실시간 관제와 경고·강제 종료
- 제출 결과, AI 채점 결과, 감독 검토 및 결과 메일 관리

### 응시자

- 초대 링크와 응시번호를 이용한 시험 입장
- 카메라·화면 공유·브라우저 환경 점검
- QR 코드 기반 모바일 보조 카메라 및 신분증 OCR 연결
- 객관식·코딩 시험 응시, 코드 실행, 자동 저장·제출

### 시험 운영 자동화

매니저가 시험별 자동 운영을 시작하면 서버가 다음 작업을 일정에 맞춰 처리합니다.

1. 유효한 응시자를 검증하고 시험에 배정
2. 설정한 사전 발송 시각에 초대 메일 전송
3. 서버 기준 시작·마감 시각으로 입장과 제출 상태 관리
4. 미응시자를 결시 처리하고 진행 중 답안을 마감
5. 코딩 답안을 AI로 채점하고 결과 리포트 생성
6. 감독 경고가 없는 결과는 메일 발송, 검토 대상은 발송 보류

자동 운영은 일시정지·재개·취소할 수 있으며, 실패한 채점과 메일 발송은 재시도할 수 있습니다. 백엔드 재시작 후에도 저장된 상태를 기준으로 누락된 작업을 이어서 처리합니다.

## 전체 서비스 플로우

### 1. 초기 운영 설정

관리자가 조직과 매니저를 승인하고 중앙 AI 연결, 조직별 AI 사용 한도, 초대 보안 정책을 설정합니다. 실제 메일과 AI 감독을 사용하려면 SendGrid 및 AI 감독 서비스 환경 변수도 등록해야 합니다.

### 2. 문제와 모범 답안 생성

1. 매니저가 시험을 만들고 출제 도우미에 언어, 난이도, 문제 설명, 입출력 조건 등 문제 양식을 입력합니다.
2. AI가 등록 가능한 코딩 문제 시안을 생성하고 형식을 검증합니다.
3. 선택된 언어별 모범 답안과 비공개 채점 기준을 생성합니다.
4. 검증이 끝난 문제와 모범 답안을 시험 문제 목록에 자동 등록합니다.

생성된 문제와 모범 답안은 응시자에게 공개되기 전에 매니저가 검토할 수 있습니다. 문제 내용을 직접 수정하면 기존 답안과 달라질 수 있으므로 모범 답안을 다시 생성해야 합니다.

### 3. 응시자 등록과 초대

1. 매니저가 이름, 이메일, 생년월일을 기준으로 응시자를 개별 또는 일괄 등록합니다.
2. 자동 운영 에이전트가 중복 이메일, 잘못된 정보, 조직 범위와 등록 상태를 검사합니다.
3. 유효한 응시자를 시험에 배정하고 설정된 시험 시작 전 시각에 일회용 링크와 응시번호를 메일로 발송합니다.
4. 발송 실패 대상과 제외 사유는 자동 운영 현황에서 확인하고 재시도할 수 있습니다.

SendGrid가 없는 로컬 환경에서는 실제 메일 대신 `PREVIEW` 상태와 입장 정보를 화면에서 확인합니다.

### 4. 본인 확인과 시험 응시

1. 응시자가 초대 링크에서 응시번호를 확인받습니다.
2. 카메라, 화면 공유, 브라우저 상태와 모바일 보조 카메라 연결을 점검합니다.
3. 신분증 OCR을 사용하는 경우 등록된 이름·생년월일과 촬영 결과를 비교합니다.
4. 서버가 시험 시작·마감 시각을 검사하고 객관식·코딩 답안과 코드 실행 결과를 저장합니다.

### 5. 실시간 감독과 자동 알림

1. PC 웹캠과 모바일 보조 카메라의 최신 화면을 감독 대시보드에 표시합니다.
2. AI가 사람 미감지, 다중 인원, 휴대전화와 선택적으로 책을 탐지합니다.
3. 설정된 연속 감지 횟수와 쿨다운을 만족하면 경고를 자동 기록하고 응시자 화면과 감독 화면에 알립니다.
4. 모바일 카메라 연결 끊김 같은 시스템 이상도 경고로 기록합니다.
5. 감독자는 수동 경고를 보내거나 사유를 남기고 시험을 강제 종료할 수 있습니다.

AI 경고는 감독자의 판단을 돕는 신호이며 단독으로 응시자를 자동 실격시키지는 않습니다.

### 6. 시험 마감과 자동 채점

1. 서버 마감 시각에 미제출 답안을 마감하고 시험을 시작하지 않은 응시자는 결시 처리합니다.
2. 객관식은 저장된 정답을 기준으로 채점하고, 코딩 답안은 등록된 중앙 AI가 모범 답안·채점 기준·실행 결과를 참고해 채점합니다.
3. AI가 총점, 문제별 점수, 알고리즘·코드 품질 평가, 복잡도, 감점 사유와 한국어 피드백을 생성합니다.
4. 실패한 AI 채점은 백오프를 적용해 재시도하며 운영 화면에서 수동 복구할 수도 있습니다.

### 7. 결과 검토, 메일과 리포팅

1. 매니저가 응시자별 작성 코드, 실행 결과, 감독 경고, 점수와 AI 분석 자료를 통합 결과 화면에서 확인합니다.
2. 감독 경고나 검토 보류가 있는 결과는 자동 메일 발송을 멈춥니다.
3. 매니저가 검토 상태를 `정상`으로 확정하면 보류된 결과 메일 전송을 다시 시작합니다.
4. 응시자에게 총점, 종합 피드백, 문제별 점수, 감점 내역과 복잡도 분석을 포함한 결과 메일을 발송합니다.
5. 시험별 처리 진행률, 완료·실패·결시·제외 인원과 메일 상태를 관리자·매니저 화면에서 조회합니다.

현재 매니저가 작성하는 `검토 메모`는 내부 운영 기록으로 저장되며 결과 메일 본문에는 포함되지 않습니다. 메일에는 AI가 생성한 피드백이 포함됩니다. 리포팅은 웹 화면에서 제공하며 PDF·Excel 파일 내보내기는 지원하지 않습니다.

### 전체 플로우 사용 조건

| 기능 | 필요한 설정 |
| --- | --- |
| AI 문제·모범 답안 생성과 코딩 채점 | 관리자 AI 연결 등록, `AI_SETTINGS_ENCRYPTION_KEY`, 조직별 AI 사용 허용·한도 |
| 실제 초대·결과 메일 | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `PUBLIC_WEB_ORIGIN` |
| PC·모바일 AI 감독 | 실행 중인 AI 감독 서비스와 `AI_PROCTOR_URL`, 필요 시 `AI_MOBILE_PROCTOR_URL` |
| 신분증 OCR | 실행 중인 OCR 서비스와 `ID_CARD_OCR_URL` |
| Python·Java·C 실행 | Judge0 호환 서버와 운영 환경의 허용 호스트 설정 |

애플리케이션 내부 흐름과 실패·재시도 처리는 자동 테스트로 검증되어 있습니다. 다만 실제 AI 공급자, SendGrid, Judge0, 카메라·네트워크를 포함한 운영 환경은 배포 환경의 키와 권한에 영향을 받으므로 출시 전 스테이징 환경에서 전체 시나리오를 한 번 확인하는 것을 권장합니다.

## 구성

```text
React 19 + Vite
        │ REST API / WebRTC 시그널링
        ▼
Node.js + Express 5 ───── Judge0 호환 코드 실행 API
        │
        ├──── FastAPI AI 감독 서비스 (YOLO ONNX)
        └──── FastAPI 신분증 OCR 서비스 (YOLO ONNX + PaddleOCR)

저장소: 로컬 JSON 또는 PostgreSQL(JSONB)
메일: SendGrid
AI: OpenAI · Anthropic · Google Gemini · DeepSeek
```

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프런트엔드 | React 19, Vite 8, React Router, Axios, Lucide React |
| 백엔드 | Node.js 20+, Express 5, PostgreSQL(`pg`) |
| AI 감독 | Python 3.11+, FastAPI, OpenCV DNN, YOLO ONNX |
| 신분증 OCR | Python 3.11+, FastAPI, ONNX Runtime, PaddleOCR |
| 외부 연동 | Judge0 호환 API, SendGrid, 생성형 AI 공급자 API |
| 테스트·품질 | Node Test Runner, Pytest, oxlint |

## 빠른 시작

### 요구 사항

- Node.js 20 이상
- npm
- AI 감독 기능 사용 시 Python 3.11 이상
- 카메라 기능 사용 시 권한을 허용할 수 있는 최신 Chromium 계열 브라우저

### Windows 일괄 실행

프로젝트 루트에서 최초 한 번 의존성을 설치합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-local.ps1
```

AI 감독 모델이 없다면 ONNX 파일을 생성합니다.

```powershell
.\ai-proctor-service\.venv\Scripts\python.exe .\ai-proctor-service\export_onnx.py
```

이후 세 서비스를 함께 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

| 서비스 | 주소 |
| --- | --- |
| 프런트엔드 | `http://localhost:5173` |
| 백엔드 상태 확인 | `http://localhost:3000/api/health` |
| AI 감독 상태 확인 | `http://127.0.0.1:8001/health` |

`start-local.ps1`은 시연 편의를 위해 시험 시작 전 입장을 허용하는 `EXAM_START_BYPASS_ENABLED=true`를 적용합니다. 운영 환경에서는 활성화하지 마세요.

### 서비스별 실행

백엔드:

```bash
cd backend
npm install
npm run dev
```

프런트엔드:

```bash
cd frontend
npm install
npm run dev
```

개발 서버는 기본적으로 `/api` 요청을 `http://localhost:3000`으로 프록시합니다. AI 감독과 OCR 서비스의 개별 실행·배포 방법은 [AI 감독 서비스 문서](ai-proctor-service/README.md)와 [신분증 OCR 서비스 문서](id-ocr-service/README.md)를 참고하세요.

## 개발 계정


| 권한 | 이메일 | 용도 |
| --- | --- | --- |
| 관리자 | `admin@aivle.com` | 전체 운영 정책과 조직·AI 설정 관리 |
| 매니저 | `supervisor@aivle.com` | A대학교 시험·응시자·감독·결과 관리 |
| 응시자 | `applicant@aivle.com` | 개발용 응시자 계정 |

실제 응시는 일반 로그인 대신 매니저가 발급한 초대 링크와 응시번호를 사용합니다.

## 환경 변수

### 백엔드

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | API 서버 포트 |
| `DATABASE_URL` | 없음 | 설정 시 PostgreSQL의 `app_state` JSONB 저장소 사용, 미설정 시 `backend/data/database.json` 사용 |
| `PUBLIC_WEB_ORIGIN` | `http://localhost:5173` | 초대·인증 메일에 포함할 공개 프런트엔드 주소 |
| `ALLOWED_ORIGINS` | 로컬 Vite 주소 | 허용할 CORS Origin 목록(쉼표 구분) |
| `SENDGRID_API_KEY` | 없음 | 가입 인증·초대·결과 메일 발송용 SendGrid 키 |
| `SENDGRID_FROM_EMAIL` | 없음 | SendGrid에서 인증한 발신 주소 |
| `SENDGRID_FROM_NAME` | 없음 | 메일 발신자 이름 |
| `AI_SETTINGS_ENCRYPTION_KEY` | 없음 | 저장하는 AI API 키의 암호화 키. 미설정 시 관리자 화면에서 키 등록 불가 |
| `AI_API_KEY` | 없음 | 기존 방식의 중앙 AI 키(관리자 화면 등록 방식 권장) |
| `CODE_EXECUTION_API_URL` | `https://ce.judge0.com` | Judge0 호환 코드 실행 서버 |
| `CODE_EXECUTION_API_KEY` | 없음 | 코드 실행 서버의 `X-Auth-Token` |
| `CODE_EXECUTION_API_ALLOWED_HOSTS` | 없음 | 운영 환경에서 허용할 실행 서버 호스트 목록(쉼표 구분) |
| `AI_PROCTOR_URL` | 없음 | PC 웹캠 AI 감독 서비스 주소 |
| `AI_MOBILE_PROCTOR_URL` | `AI_PROCTOR_URL` | 모바일 보조 카메라 전용 AI 감독 주소 |
| `AI_PROCTOR_API_KEY` | 없음 | AI 감독 서비스와 공유하는 Bearer 인증 키 |
| `AI_PROCTOR_CONFIDENCE` | `0.55` | 탐지 이벤트의 최소 신뢰도 |
| `AI_PROCTOR_CONSECUTIVE_HITS` | `2` | 경고 전 필요한 연속 감지 횟수 |
| `AI_PROCTOR_WARNING_COOLDOWN_SECONDS` | `60` | 같은 유형의 경고 재발생 대기 시간 |
| `AI_PROCTOR_BOOK_DETECTION_ENABLED` | `false` | 책 탐지 활성화 여부 |
| `ID_CARD_OCR_URL` | 없음 | 신분증 OCR 서비스 주소 |
| `ID_CARD_OCR_API_KEY` | 없음 | OCR 서비스의 `ID_CARD_SERVICE_TOKEN`과 같은 값 |
| `EXAM_START_BYPASS_ENABLED` | `false` | 개발 시에만 사용하는 시험 시작 시각 우회 기능 |

### 프런트엔드

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | 백엔드 API 기본 주소 |

### Python 서비스

| 서비스 | 변수 | 설명 |
| --- | --- | --- |
| AI 감독 | `AI_PROCTOR_MODEL_PATH` | ONNX 모델 경로, 기본값 `yolo11n.onnx` |
| AI 감독 | `AI_PROCTOR_API_KEY` | 백엔드와 공유하는 인증 키 |
| AI 감독 | `AI_PROCTOR_BOOK_DETECTION_ENABLED` | 책 탐지 활성화 여부 |
| OCR | `ID_CARD_YOLO_MODEL_PATH` | 신분증 탐지 ONNX 모델 경로, 기본값 `models/best.onnx` |
| OCR | `ID_CARD_SERVICE_TOKEN` | OCR API Bearer 인증 토큰 |

비밀값은 저장소에 커밋하지 말고 배포 환경의 Secret/Environment Variable로 관리하세요.

## 주요 동작

### 초대와 응시

1. 매니저가 시험 일정·문제와 응시자를 등록합니다.
2. 응시자를 직접 배정하거나 시험 운영 자동화를 시작합니다.
3. 응시자는 `/invite/:token` 또는 `/exam/enter?token=...` 링크에서 응시번호를 확인받습니다.
4. 사전 환경 점검과 신분증 확인을 마치고 시험에 입장합니다.
5. 서버 마감 시각에 제출되지 않은 답안도 자동 마감 처리됩니다.

SendGrid가 설정되지 않은 로컬 환경에서는 가입 인증과 초대를 `PREVIEW` 상태로 생성하여 화면에서 링크와 인증 정보를 확인할 수 있습니다.

### AI 감독

- PC 웹캠과 모바일 보조 카메라 화면을 독립적으로 분석합니다.
- 사람 미감지, 다중 인원, 휴대전화, 선택적 책 탐지를 지원합니다.
- 연속 탐지와 경고 쿨다운은 백엔드가 관리하고, 경고는 감독·응시자 화면에 전달됩니다.
- AI 탐지는 감독자 판단을 보조하며 그 자체로 자동 실격시키지 않습니다.
- Python 서비스는 원본 이미지와 Base64 데이터를 파일·DB·로그에 저장하지 않습니다.

### 신분증 OCR

- YOLO로 신분증 영역을 찾고 PaddleOCR로 이름과 주민번호 앞 6자리를 읽습니다.
- 백엔드가 등록된 이름·생년월일과 비교하고 일치 여부만 저장합니다.
- 촬영 이미지, 잘라낸 이미지, OCR 원문과 주민번호 값은 저장하지 않습니다.

### AI 출제·채점

- OpenAI, Anthropic, Google Gemini, DeepSeek 연결을 지원합니다.
- 관리자만 공급자 키를 등록·검증·활성화할 수 있고 키는 암호화하여 저장합니다.
- 조직별 AI 사용 여부와 월간 한도를 적용합니다.
- 문제 시안, 모범 답안, 자동 채점 호출과 결과를 감사 로그에서 확인할 수 있습니다.

### 코드 실행

- JavaScript는 브라우저에서 실행합니다.
- Python, Java, C 코드는 백엔드가 Judge0 호환 서버로 전달합니다.
- 실행 요청에는 CPU 3초, 벽시계 5초, 메모리 256MB 및 응시자별 동시 실행 제한을 적용합니다.
- 공개 Judge0 기본 주소는 개발·시연용이며 운영 환경에서는 전용 실행 서버와 허용 호스트를 설정하세요.

## API 개요

| 영역 | 대표 엔드포인트 |
| --- | --- |
| 인증 | `/api/auth/login`, `/api/auth/logout`, `/api/auth/signup` |
| 이메일 인증 | `/api/auth/email-verification/send`, `/api/auth/email-verification/confirm` |
| 관리자 | `/api/admin/overview`, `/api/admin/organizations`, `/api/admin/ai-settings` |
| 매니저 | `/api/manager/organizations`, `/api/manager/exams`, `/api/manager/candidates` |
| 초대·응시 | `/api/manager/exams/:id/invitations/send`, `/api/invitations/:token/verify` |
| 감독 | `/api/supervisor/examinees`, `/api/supervisor/warnings` |
| 자동 운영 | `/api/manager/exams/:examId/automation/start`, `/api/manager/exams/:examId/automation-status` |
| 결과 | `/api/manager/results`, `/api/manager/exams/:examId/results/:candidateId` |

보호된 API는 다음 인증 헤더를 사용합니다.

```http
Authorization: Bearer <token>
```

## 프로젝트 구조

```text
.
├── frontend/                    # React/Vite 웹 애플리케이션
│   └── src/
│       ├── admin/               # 관리자 운영 화면
│       ├── manager/             # 시험·문제·응시자·자동 운영 화면
│       ├── supervisor/          # 실시간 관제·경고·결과 화면
│       ├── applicant/           # 응시자 기능과 상태 처리
│       ├── pages/               # 공개·인증·시험·모바일 페이지
│       └── api/client.js        # API 클라이언트와 인증 헤더
├── backend/
│   ├── src/app.mjs              # REST API와 업무 흐름
│   ├── src/store.mjs            # JSON/PostgreSQL 저장소
│   ├── src/examOperationsAgent.mjs
│   ├── src/problemAuthoringAgent.mjs
│   └── test/                    # 백엔드 통합·단위 테스트
├── ai-proctor-service/          # YOLO 기반 AI 감독 FastAPI 서비스
├── id-ocr-service/              # 신분증 탐지·OCR FastAPI 서비스
├── docs/                        # 정책·설계 보조 문서
├── DESIGN.md                    # UI 디자인 시스템
├── setup-local.ps1              # Windows 개발 환경 설치
└── start-local.ps1              # Windows 로컬 서비스 일괄 실행
```

## 검증

백엔드:

```bash
cd backend
npm test
```

프런트엔드:

```bash
cd frontend
npm test
npm run lint
npm run build
```

Python 서비스:

```bash
cd ai-proctor-service
python -m pytest tests
```

```bash
cd id-ocr-service
python -m pytest tests
```

## 운영 시 참고 사항

- 로컬 기본 저장소는 `backend/data/database.json`입니다. `DATABASE_URL`을 설정하면 PostgreSQL을 사용할 수 있지만 현재는 전체 애플리케이션 상태를 단일 JSONB 문서로 저장하므로, 대규모 트래픽이나 다중 인스턴스 운영에는 정규화된 데이터 모델과 동시성 제어가 추가로 필요합니다.
- AI 감독의 연속 감지·대기열 상태는 백엔드 프로세스 메모리에서 관리됩니다. 다중 인스턴스 배포 시 Redis 같은 공유 저장소와 분산 잠금이 필요합니다.
- 실제 메일 발송에는 인증된 SendGrid 발신자와 공개 프런트엔드 주소가 필요합니다.
- 모바일 카메라·화면 공유는 브라우저 보안 정책상 HTTPS 또는 localhost 환경과 사용자 권한 승인이 필요합니다.
- 운영 배포 전 개인정보 보관 주기, 감사 로그, 영상 처리, 장애 복구 정책을 서비스 환경에 맞게 검토하세요.
