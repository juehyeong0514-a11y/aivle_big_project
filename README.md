# ProctorAI

- 팀 빅프로젝트로 진행한 AI 기반 역량 테스트 플랫폼 ProctorAI
- React/Vite 프런트엔드와 Express 백엔드로 구성
- 조직별 시험 생성, 응시자 초대, 시험 응시, 실시간 관제, 결과 조회 지원
- 개발 환경에서 JSON 저장소 사용
- 서버에서 권한과 조직 범위 검증

## 주요 기능

- 이메일 인증 기반 매니저 가입 신청 및 로그인
- 관리자의 매니저·조직 승인, 중앙 AI 설정·로그, 초대 정책 관리
- 매니저별 승인 조직 범위 적용 및 조직 코드 가입 요청 승인
- 조직별 시험 생성, 문제 등록, 응시자 등록·일괄 배정·배정 해제
- AI 대화 기반 코딩 문제 작성
  - 제목, 예제, 숨김 테스트, 채점 방식 설정
- 응시자별 일회용 초대 링크 생성 및 테스트용 링크 복사
- 초대 링크와 응시번호 확인 후 시험 응시
- 조직별 실시간 관제 대상, 경고 기록, 응시 현황, 결과 조회

## 권한과 접근 방식

| 권한 | 접근 방식 | 주요 기능 |
| --- | --- | --- |
| 관리자 | 관리자 로그인 | 매니저·조직 승인, 중앙 AI 연동 설정, 채점 대기열·로그, 초대 정책 관리 |
| 매니저 | 매니저 로그인 | 조직 운영, 시험·문제·응시자·초대·실시간 관제·결과 관리 |
| 응시자 | 초대 링크 | 응시번호 확인, 사전 환경 점검, 시험 제출 |

- 응시자의 일반 회원가입 및 시험 목록 입장 미지원
- 매니저가 생성한 초대 링크와 응시번호 확인 후 시험 세션 생성

## 실행 방법

- 권장 환경: Node.js 20 이상
- 백엔드와 프런트엔드 개별 실행

### 1. 백엔드

```bash
cd backend
npm install
npm run dev
```

- 기본 API 주소: `http://localhost:3000`
- 최초 실행 시 `backend/data/database.json` 생성

### 2. 프런트엔드

```bash
cd frontend
npm install
npm run dev
```

- 기본 접속 주소: `http://localhost:5173`
- `/api` 요청을 백엔드로 프록시
- 별도 배포 환경에서 환경 변수 설정 필요

### Windows 로컬 일괄 실행

- 최초 실행 또는 의존성 변경 시 프로젝트 루트에서 초기 설정 실행

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-local.ps1
```

- 이후 아래 명령으로 AI 감독 서비스, 백엔드, 프런트엔드 일괄 실행
- 동일한 로컬 환경 변수 적용

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

## 환경 변수

| 변수 | 용도 |
| --- | --- |
| `VITE_API_BASE_URL` | 프런트엔드 API 기본 주소 |
| `PUBLIC_WEB_ORIGIN` | 초대 메일에 포함할 프런트엔드 공개 주소 |
| `ALLOWED_ORIGINS` | 허용할 CORS Origin 목록(쉼표 구분) |
| `SENDGRID_API_KEY` | SendGrid API 키 및 가입 인증·시험 초대 메일 발송 설정 |
| `SENDGRID_FROM_EMAIL` | SendGrid Single Sender 인증 완료 발신 주소 |
| `SENDGRID_FROM_NAME` | 메일 발신자 이름(예: `팀프로젝트 시험 플랫폼`) |
| `CODE_EXECUTION_API_URL` | Judge0 호환 코드 실행 서버 주소 |
| `CODE_EXECUTION_API_KEY` | 실행 서버 인증용 `X-Auth-Token`(선택) |
| `CODE_EXECUTION_API_ALLOWED_HOSTS` | 별도 실행 서버 허용 호스트 목록(쉼표 구분) |

- JavaScript 코드를 브라우저에서 실행
- Python·Java·C 코드를 백엔드에서 Judge0 호환 서버로 전달
- `CODE_EXECUTION_API_URL` 미설정 시 시연용 공개 Judge0 CE 사용
- 별도 실행 서버 사용 시 URL과 허용 호스트 설정 필요
- 실행 요청 제한
  - CPU 3초
  - 벽시계 5초
  - 메모리 256MB
  - 응시자별 요청 및 동시 실행 제한

## 신분증 OCR 모델 연동

| 변수 | 용도 |
| --- | --- |
| `ID_CARD_OCR_URL` | 신분증 이미지(`{ "image": "data:image/..." }`) 수신 학습 모델 API 주소 |
| `ID_CARD_OCR_API_KEY` | 모델 API Bearer 인증 키(선택) |

- [id-ocr-service/README.md](id-ocr-service/README.md)를 통한 YOLO 기반 OCR 서비스 별도 배포
- 학습 원본 `best.pt`와 배포용 `best.onnx`를 `id-ocr-service/models`에 포함
- 백엔드의 `ID_CARD_OCR_URL`에 OCR 서비스 주소 등록
- 모델 응답 형식
  - `residentNumberFront` 또는 `birthDate`에 주민번호 앞 6자리(`YYMMDD`) 반환
  - 예시: `{ "residentNumberFront": "000101" }`
- 등록된 생년월일과 비교 후 결과만 저장
- 주민번호 앞 6자리 미저장

## 시험용 AI 감독 MVP

- 응시자 웹캠 정지 화면을 2초 주기로 FastAPI 서비스에서 분석
- 범용 YOLO 모델을 ONNX로 변환해 OpenCV DNN으로 실행(`ultralytics`·`torch` 미사용, 512MB 인스턴스 대응)
- 감독 화면의 최신 분석 결과를 2초 주기로 갱신
- 사람 미감지, 여러 사람, 휴대전화, 선택적 책 감지 지원
- Node 백엔드에서 연속 감지와 경고 대기 시간 관리
- AI 경고를 감독 화면과 응시자 경고 창에 표시
- 자동 제출·종료·실격 처리에는 미사용

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `AI_PROCTOR_URL` | 없음 | AI 감독 서비스 기본 주소 |
| `AI_PROCTOR_API_KEY` | 없음 | 서비스 간 Bearer 인증 키 |
| `AI_PROCTOR_CONFIDENCE` | `0.55` | 이벤트 확정 최소 신뢰도 |
| `AI_PROCTOR_CONSECUTIVE_HITS` | `2` | 경고 전 연속 감지 횟수 |
| `AI_PROCTOR_WARNING_COOLDOWN_SECONDS` | `60` | 동일 유형 경고 대기 시간 |
| `AI_PROCTOR_BOOK_DETECTION_ENABLED` | `false` | 책 이벤트 활성화 여부 |
| `AI_PROCTOR_MODEL_PATH` | `yolo11n.onnx` | ONNX 가중치 경로(`.pt` 지정 시 같은 이름의 `.onnx` 사용) |
| `OMP_NUM_THREADS` | 없음 | `1` 권장, 저사양 인스턴스의 스레드별 버퍼 메모리 절감 |

- `AI_PROCTOR_URL` 미설정 또는 서비스 중단 시 AI 분석만 생략
- 시험, 스냅샷, WebRTC 기능은 계속 동작
- [ai-proctor-service/README.md](ai-proctor-service/README.md)를 참고한 별도 프로세스 또는 웹 서비스 배포
- 배포 전 `python export_onnx.py`로 `yolo11n.onnx` 생성 필요
- 입력 이미지와 Base64 데이터 미저장 및 로그 미출력
- MVP 상태를 Express 프로세스 메모리에서 관리
  - 감지 횟수
  - 경고 대기 시간
  - 처리 중 상태
- 재시작 시 상태 초기화 및 다중 인스턴스 간 미공유
- 운영 확장 시 Redis 기반 분산 잠금과 멱등성 저장소 필요

## 중앙 AI 채점·문제 생성 연동

- 관리자의 `시험 조회 및 설정 → 중앙 AI 채점 설정` 메뉴에서 공급자와 API 키 등록
- 모범 답안 생성, 자동 채점, 문제 생성 챗봇에서 동일한 연동 공유
- 지원 공급자
  - OpenAI
  - Anthropic
  - Google Gemini
  - DeepSeek
- 등록된 키를 서버에 암호화하여 저장
- `API 키 확인` 기능으로 공급자별 실제 API 검증
- 모든 호출을 `AI 프롬프트·응답 로그`에서 감사 로그로 조회

## 개발 계정

- 기본 비밀번호: `123`

| 권한 | 이메일 | 용도 |
| --- | --- | --- |
| 매니저 | `manager@example.com` | 조직 시험 관리, 관제, 결과 조회 |
| 관리자 | `admin@example.com` | 관리자 화면과 전체 운영 관리 |

- 응시자를 매니저가 등록하고 초대
- 시험 관리 화면에서 대상자 선택 후 `선택 대상자 배정 및 초대` 실행
- 응시번호와 입장 링크 동시 표시

## 초대 및 응시 흐름

1. 매니저의 시험·문제·응시자 등록
2. 시험 대상자 선택, 배정, 초대 생성
3. 개발 환경에서 응시번호와 `/exam/enter?token=...` 링크 확인·복사
4. 응시자의 링크 접속 및 응시번호 입력
5. 응시자 세션 생성 후 사전 환경 점검과 시험 화면으로 이동

- 메일 웹훅 미설정 개발 환경에서 초대와 이메일 인증을 `PREVIEW` 상태로 생성
- 운영 환경에서 실제 메일 전달 서비스와 공개 웹 주소 설정 필요

## API 개요

| 영역 | 대표 API |
| --- | --- |
| 인증 | `/api/auth/login`, `/api/auth/logout`, `/api/auth/signup` |
| 이메일 인증 | `/api/auth/email-verification/send`, `/api/auth/email-verification/confirm` |
| 관리자 | `/api/admin/overview`, `/api/admin/organizations`, `/api/admin/exams`, `/api/admin/candidates` |
| 매니저 | `/api/manager/organizations`, `/api/manager/exams`, `/api/manager/candidates` |
| 초대·응시 | `/api/manager/exams/:id/invitations/send`, `/api/invitations/:token`, `/api/invitations/:token/verify` |
| 관제·결과 | `/api/supervisor/exams`, `/api/supervisor/examinees`, `/api/supervisor/warnings`, `/api/manager/results` |

- 보호된 API의 인증 헤더

```http
Authorization: Bearer <token>
```

## 프로젝트 구조

```text
.
├── frontend/
│   └── src/
│       ├── admin/        # 관리자 화면
│       ├── manager/      # 매니저 시험·초대 관리
│       ├── supervisor/   # 관제·경고·결과 화면
│       ├── applicant/    # 응시자 홈 화면
│       ├── pages/        # 로그인, 초대, 시험, 모바일 점검
│       └── api/client.js # Axios와 인증 헤더
├── backend/
│   ├── src/app.mjs       # REST API, 인증, 조직 범위 검증
│   ├── src/store.mjs     # JSON 저장소와 비밀번호 해싱
│   ├── src/seed.mjs      # 초기 데이터
│   └── test/api.test.mjs # API 통합 테스트
└── README.md
```

## 검증 명령

```bash
cd backend
npm test
```

```bash
cd frontend
npm run build
npm run lint
```

## 현재 제한 사항

- `backend/data/database.json` 기반 개발용 저장소
- 다중 서버, 동시성 제어, 백업·복구가 필요한 운영 환경에서 외부 관계형 데이터베이스 필요
- 이메일 웹훅 어댑터 방식 사용
- 운영 환경에서 메일 제공자 연동과 비밀값 관리 필요
- 사전 환경 점검의 카메라·화면 공유를 브라우저 권한 확인용으로 사용
- 운영 수준의 다중 기기 보조 카메라 연결, 영상 업로드, AI 본인 인증 기능 미구현
- 시험 제한 시간을 화면에 표시하나 서버 마감 시각 기준 강제 미지원
- 실제 운영 전 서버 기준 시작·마감 시간과 제출 차단 기능 필요

## 운영 전 권장 작업

1. JSON 저장소의 관계형 데이터베이스 이전 및 마이그레이션 구성
2. 초대·가입 인증 메일 공급자와 공개 URL 설정
3. 서버 기준 시험 제한 시간과 재입장 정책 구현
4. 모바일 보조 카메라의 실제 기기 연결 기능 구성
5. 영상 수집·보관·AI 분석·부정행위 이벤트 처리 및 개인정보 정책 구현

| 기능 | 상태 |
| --- | --- |
| 조직·권한 관리 | 구현 완료 |
| 시험·문제·응시자 CRUD | 대부분 구현 완료 |
| 초대 링크·응시번호 | 구현 완료, 시험 종료 시각 기준 링크 만료 |
| 객관식 시험 제출·점수 | 구현 완료 |
| AI 기반 문제 생성 | 구현 완료 |
| 실제 이메일 발송 | 환경 변수 미설정 시 미지원 |
| 모바일 카메라 실행 | 구현 완료 |
| PC·모바일 연결 | 구현 완료 |
| 실시간 영상 관제 | 구현 완료 |
| AI 부정행위 탐지 | 구현 완료 |
| 실시간 경고 전달 | 구현 완료 |
| 서버 기준 시험 시간 | 미구현 |
| AI 모델 연동 | 구현 완료 |

## 운영 메뉴 구성

- 상단 내비게이션(`frontend/src/components/Header.jsx`) 기준 메뉴 구조

### 관리자 메뉴

| 그룹 | 메뉴 |
| --- | --- |
| 공지사항 | 공지사항 · 공지사항 관리 |
| 조직·매니저 | 조직 승인 및 매니저 관리 · 조직 커뮤니티 |
| 시험 조회 및 설정 | 중앙 AI 채점 설정 · AI 채점 요청 대기열 · AI 프롬프트·응답 로그 · 초대 링크 설정 |

### 매니저 메뉴

| 그룹 | 메뉴 |
| --- | --- |
| 조직·소통 | 조직 관리 · 공지사항 · 공지사항 관리 · 커뮤니티 관리 |
| 시험 운영 | 시험 총괄 대시보드 · 시험 생성 · 문제 관리 · 응시자 배정 · AI 챗봇 문제 생성 · 시험 금지사항 관리 |
| 감독·결과 | 화상 모니터링 · 응시자 관리 · AI 채점 보고서 |
