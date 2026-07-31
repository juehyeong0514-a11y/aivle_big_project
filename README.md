# AI 리터러시 역량 테스트 플랫폼

조직별 시험 생성·응시자 초대·시험 응시·관리자 관제와 결과 조회를 제공하는 React/Vite + Express 프로젝트입니다. 개발용 JSON 저장소를 사용하며, 조직 관리자와 ADMIN의 권한 및 조직 범위를 서버에서 검증합니다.

## 주요 기능

- 운영자 로그인과 이메일 인증 기반 조직 관리자 가입 신청
- ADMIN의 관리자·조직 승인, 시험·응시자 통합 조회
- 조직 관리자별 승인 조직 범위 적용
- 조직별 시험 생성, 문제 등록, 응시자 등록·일괄 배정·배정 해제
- 응시자별 일회용 초대 링크 생성 및 테스트용 링크 복사
- 초대 링크 + 응시번호 확인 후 시험 응시
- 조직별 실시간 관제 대상, 경고 기록, 응시 현황, 결과 조회

## 역할과 접근 방식

| 역할 | 접근 | 주요 기능 |
| --- | --- | --- |
| ADMIN | 운영자 로그인 | 관리자·조직 승인, 전체 시험/응시자 조회, 정책 관리 |
| 조직 관리자 | 운영자 로그인 | 승인된 조직의 시험·문제·응시자·초대·관제·결과 관리 |
| 응시자 | 초대 링크 | 응시번호 확인, 사전 환경 점검, 시험 제출 |

응시자는 일반 회원가입이나 시험 목록으로 입장하지 않습니다. 관리자가 만든 초대 링크에서 응시번호를 확인해야 시험 세션이 생성됩니다.

## 실행 방법

Node.js 20 이상을 권장합니다. 백엔드와 프런트엔드를 각각 실행하세요.

### 1. 백엔드

```bash
cd backend
npm install
npm run dev
```

API 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다. 첫 실행 시 `backend/data/database.json`이 생성됩니다.

### 2. 프런트엔드

```bash
cd frontend
npm install
npm run dev
```

Vite가 표시하는 주소로 접속합니다. 기본 주소는 `http://localhost:5173`입니다.

프런트엔드는 `/api` 요청을 백엔드로 프록시합니다. 별도 배포 환경에서는 다음 환경 변수를 설정하세요.

| 변수 | 용도 |
| --- | --- |
| `VITE_API_BASE_URL` | 프런트엔드 API 기본 주소 |
| `PUBLIC_WEB_ORIGIN` | 초대 메일에 넣을 프런트엔드 공개 주소 |
| `ALLOWED_ORIGINS` | 허용할 CORS Origin 목록(쉼표 구분) |
| `SENDGRID_API_KEY` | SendGrid API 키. 설정하면 관리자 가입 인증 메일과 시험 초대 메일을 실제 발송합니다. |
| `SENDGRID_FROM_EMAIL` | SendGrid에서 Single Sender 인증을 마친 발신 이메일 주소 |
| `SENDGRID_FROM_NAME` | 메일에 표시할 발신자 이름. 예: `Aivle 시험 플랫폼` |

## 개발 계정

## 신분증 OCR 모델 연결

백엔드 환경 변수에 아래 값을 등록하면 신분증 QR 촬영 결과를 학습한 OCR 모델로 보낼 수 있습니다.

| 변수 | 용도 |
| --- | --- |
| `ID_CARD_OCR_URL` | 신분증 이미지(`{ "image": "data:image/..." }`)를 받는 학습 모델 API 주소 |
| `ID_CARD_OCR_API_KEY` | 모델 API에 Bearer 인증이 필요한 경우의 키(선택) |

YOLO 기반 신분증 OCR 서비스는 [id-ocr-service/README.md](id-ocr-service/README.md)를 따라 별도 Render Web Service로 배포합니다. `best.pt`는 `id-ocr-service/models/best.pt`에 포함되어 있으며, 기존 백엔드에는 OCR 서비스의 기본 주소를 `ID_CARD_OCR_URL`로 등록합니다. 예: `https://aivle-id-ocr.onrender.com`

모델 응답은 `residentNumberFront` 또는 `birthDate`에 주민번호 앞 6자리(`YYMMDD`)를 반환해야 합니다. 예: `{ "residentNumberFront": "000101" }`.
서버는 이 값으로 등록된 생년월일과 비교한 뒤 결과만 저장하며, 주민번호 앞 6자리는 저장하지 않습니다.

기본 비밀번호는 모두 `123`입니다.

| 계정 | 이메일 | 용도 |
| --- | --- | --- |
| 조직 관리자 | `supervisor@aivle.com` | 조직 시험 관리, 관제, 결과 조회 |
| 전체 운영자 | `admin@aivle.com` | ADMIN 화면과 전체 운영 관리 |

응시자는 관리자가 등록하고 초대해야 합니다. 시험 관리 화면에서 대상자를 선택한 뒤 **선택 대상자 배정 및 초대**를 누르면 응시번호와 입장 링크가 함께 표시됩니다.

## 초대 및 응시 흐름

1. 조직 관리자가 시험·문제·응시자를 등록합니다.
2. 시험 대상자를 선택해 배정하고 초대를 생성합니다.
3. 개발 환경에서는 생성 직후 응시번호와 `/exam/enter?token=...` 링크를 확인·복사할 수 있습니다.
4. 응시자가 링크를 열고 응시번호를 입력합니다.
5. 응시자 세션이 생성되면 사전 환경 점검과 시험 화면으로 이동합니다.

메일 웹훅이 설정되지 않은 개발 환경에서는 초대와 이메일 인증이 `PREVIEW` 상태로 생성됩니다. 운영 환경에서는 실제 메일 전달 서비스와 공개 웹 주소를 반드시 설정하세요.

## API 개요

| 영역 | 대표 API |
| --- | --- |
| 인증 | `/api/auth/login`, `/api/auth/logout`, `/api/auth/signup` |
| 이메일 인증 | `/api/auth/email-verification/send`, `/api/auth/email-verification/confirm` |
| ADMIN | `/api/admin/overview`, `/api/admin/organizations`, `/api/admin/exams`, `/api/admin/candidates` |
| 조직 관리자 | `/api/manager/organizations`, `/api/manager/exams`, `/api/manager/candidates` |
| 초대·응시 | `/api/manager/exams/:id/invitations/send`, `/api/invitations/:token`, `/api/invitations/:token/verify` |
| 관제·결과 | `/api/supervisor/exams`, `/api/supervisor/examinees`, `/api/supervisor/warnings`, `/api/manager/results` |

보호된 API는 아래 헤더를 사용합니다.

```http
Authorization: Bearer <token>
```

## 프로젝트 구조

```text
.
├── frontend/
│   └── src/
│       ├── admin/        # ADMIN 화면
│       ├── manager/      # 조직 관리자 시험·초대 관리
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

- 저장소는 `backend/data/database.json` 기반의 개발용 구현입니다. 다중 서버, 동시성 제어, 백업·복구가 필요한 운영 환경에는 PostgreSQL 등 외부 DB로 전환해야 합니다.
- 이메일은 웹훅 어댑터 방식입니다. SMTP/메일 제공자 연동과 운영용 비밀값 관리는 별도로 구성해야 합니다.
- 사전 환경 점검의 카메라·화면 공유는 브라우저 권한 확인용입니다. 실제 다중 기기 보조 카메라 연결, 영상 업로드, AI 본인 인증, WebRTC 스트리밍·자동 부정행위 탐지는 아직 운영 가능한 서버 기능으로 구현되어 있지 않습니다.
- 시험 제한 시간은 현재 화면에 표시되지만 서버에서 마감 시각으로 강제하지 않습니다. 실제 시험 운영 전에는 서버 기준 시작/마감 시간 및 제출 차단을 추가해야 합니다.

## 운영 전 권장 작업

1. JSON 저장소를 관계형 DB로 이전하고 마이그레이션을 구성합니다.
2. 초대 메일·가입 인증 메일 공급자와 공개 URL을 설정합니다.
3. 서버 기준 시험 제한 시간과 재입장 정책을 구현합니다.
4. 모바일 보조 카메라를 실제 기기 페어링 API/WebSocket 또는 WebRTC 시그널링으로 교체합니다.
5. 영상 수집·보관·AI 분석·부정행위 이벤트 처리 및 개인정보 정책을 구현합니다.

| 기능 | 상태 |
|---|---|
| 조직·관리자 권한 | 구현됨 |
| 시험·문제·응시자 CRUD | 대부분 구현됨 |
| 초대 링크·응시번호 | 구현됨, 기본 포트 버그 있음 |
| 객관식 시험 제출·점수 | 구현됨 |
| 실제 이메일 발송 | 환경변수 없으면 미구현 |
| 모바일 카메라 실행 | 부분 구현 |
| PC–모바일 실제 연결 | 미구현 |
| 얼굴 인증 AI | 미구현 |
| 실시간 영상 관제 | 미구현 |
| AI 부정행위 탐지 | 미구현 |
| 실시간 경고 전달 | 미구현 |
| 서버 기준 시험 시간 | 미구현 |
| AI 모델 연동 | 미구현 |

# 메뉴 개선 제안

## ADMIN 메뉴

| 메뉴 | 개선 의견 |
|------|-----------|
| **전체 시험 관리** | **전체 시험 조회**로 이 변경하고 **SUPERVISOR** 메뉴로 이동. |
| **문제/정책 관리** | **시험 정책 관리**로 변경하고 **SUPERVISOR** 메뉴로 이동. |
| **금지사항 관리** | **시험 금지사항 관리**로 변경하고 **SUPERVISOR** 메뉴로 이동. |
| **AI 분석 설정** | 메뉴명은 유지. **초대 링크 만료 시간**은 AI 설정과 관련이 없으므로 별도 설정 메뉴로 분리. |

---

## SUPERVISOR 메뉴

| 메뉴 | 개선 의견 |
|------|-----------|
| **조직 운영** | 현재 위치 유지. 조직 단위 관리 기능으로 적절함. |
| **시험 관리** | 현재 위치 유지. 시험 생성 및 운영 기능과 일치함. |
| **응시자 접속 및 제출 현황** | 현재 위치 유지. 응시자의 접속 및 제출 상태를 확인하는 기능으로 적절함. |
| **실시간 화상 관제실** | 현재는 응시자 화면 조회 기능에 가까우므로, 실시간 AI 감독 기능을 추가하거나 **화상 모니터링**으로 메뉴명을 변경하는 것이 적절함. |
| **부정행위 감지 로그** | 현재 위치 유지. 시험 중 발생한 부정행위 기록을 확인하는 기능으로 적절함. |
