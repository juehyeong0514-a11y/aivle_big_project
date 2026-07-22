# AI 리터러시 역량 테스트 플랫폼

실시간 AI 감독과 자동 평가를 목표로 하는 온라인 역량 평가 플랫폼입니다. 현재는 React 프론트엔드와 Express 기반 개발용 REST API가 연결되어 있으며, 역할별 화면에서 실제 API 데이터를 조회·등록할 수 있습니다.

## 현재 구현 범위

- 응시자, 감독관, 관리자 역할별 로그인
- 응시자용 시험 목록 및 공지사항 조회
- 관리자용 시험 등록 및 응시자 목록 조회
- 감독관용 실시간 관제 대상 조회 및 경고 발송
- JSON 파일 기반 개발용 데이터 저장
- 역할 기반 API 권한 확인

AI 영상 분석, 실제 WebRTC 스트림 전송, 자동 채점, 파일 업로드는 화면 흐름만 준비되어 있으며 별도 서버 연동이 필요한 다음 단계 기능입니다.

## 아키텍처

```text
Browser
  |
  | http://localhost:5173
  v
frontend/ (React + Vite)
  |
  | /api/*  Vite proxy
  v
backend/ (Express)
  |
  v
backend/data/database.json (개발용 JSON 저장소)
```

프론트는 API 주소를 직접 사용하지 않고 `/api`로 요청합니다. [frontend/vite.config.js](frontend/vite.config.js)에서 해당 요청을 `http://localhost:3000` 백엔드로 전달합니다.

## 프로젝트 구조

```text
.
├── frontend/
│   ├── src/
│   │   ├── api/client.js          # Axios 공통 설정 및 인증 헤더
│   │   ├── admin/                 # 관리자 화면
│   │   ├── applicant/             # 응시자 화면
│   │   ├── supervisor/            # 감독관 화면
│   │   └── pages/AuthPage.jsx     # 로그인·회원가입
│   └── vite.config.js             # /api 개발 프록시
├── backend/
│   ├── src/app.mjs                # REST API 및 권한 처리
│   ├── src/store.mjs              # JSON 저장소 및 비밀번호 해싱
│   ├── src/seed.mjs               # 최초 실행용 기본 데이터
│   ├── src/server.mjs             # 서버 실행 진입점
│   └── test/api.test.mjs          # API 통합 테스트
└── README.md
```

## 시작하기

Node.js 20 이상을 권장합니다. 프론트와 백엔드는 각각 별도 터미널에서 실행합니다.

### 1. 백엔드 실행

```bash
cd backend
npm install
npm run dev
```

API 서버는 `http://localhost:3000`에서 실행됩니다. 최초 실행하면 `backend/data/database.json`이 생성됩니다.

### 2. 프론트 실행

```bash
cd frontend
npm install
npm run dev
```

프론트는 기본적으로 `http://localhost:5173`에서 실행됩니다. 해당 포트가 이미 사용 중이면 Vite가 다른 포트를 안내하므로, 안내된 주소로 접속하면 됩니다.

## 개발용 계정

기본 계정의 비밀번호는 모두 `123`입니다.

| 역할 | 이메일 | 사용 화면 |
| --- | --- | --- |
| 응시자 | `applicant@aivle.com` | 시험, 공지, 환경 점검 |
| 감독관 | `supervisor@aivle.com` | 실시간 관제, 경고 발송 |
| 관리자 | `admin@aivle.com` | 시험 생성, 응시자 관리 |

공개 회원가입은 `APPLICANT`(응시자)만 가능합니다. 관리자와 감독관 계정은 현재 기본 데이터로 제공되며, 운영 환경에서는 별도의 관리자 계정 생성 절차를 추가해야 합니다.

## API 목록

| Method | Endpoint | 설명 | 권한 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 서버 상태 확인 | 공개 |
| `POST` | `/api/auth/signup` | 응시자 회원가입 | 공개 |
| `POST` | `/api/auth/login` | 역할별 로그인 및 토큰 발급 | 공개 |
| `GET` | `/api/exams` | 시험 목록 조회 | 공개 |
| `GET` | `/api/notices` | 공지사항 조회 | 공개 |
| `GET` | `/api/admin/users` | 응시자 목록 조회 | 관리자 |
| `POST` | `/api/admin/exams` | 시험 등록 | 관리자 |
| `GET` | `/api/supervisor/examinees` | 관제 대상 조회 | 감독관 |
| `POST` | `/api/supervisor/examinees/:id/warnings` | 응시자 경고 발송 | 감독관 |

보호된 API는 로그인 응답의 토큰을 다음 형식으로 전달해야 합니다.

```http
Authorization: Bearer <token>
```

프론트에서는 [frontend/src/api/client.js](frontend/src/api/client.js)의 `authHeaders()`가 이 헤더를 처리합니다.

## 데이터와 보안

- 개발 데이터는 `backend/data/database.json`에 저장되며 Git에는 포함되지 않습니다.
- 비밀번호는 `scrypt` 해시로 저장합니다. 평문 비밀번호는 API 응답과 저장 파일에서 제거됩니다.
- 서버 재시작 시 로그인 토큰은 초기화되므로 다시 로그인해야 합니다.
- 개발용 JSON 저장소는 데모와 기능 개발용입니다. 동시 사용자, 백업, 검색·통계가 필요한 운영 환경에는 적합하지 않습니다.

개발 데이터를 처음 상태로 되돌리려면 백엔드를 종료한 뒤 `backend/data/database.json`을 삭제하고 다시 실행합니다.

## 화면과 API 연결 위치

| 화면 | 프론트 파일 | 사용 API |
| --- | --- | --- |
| 로그인·회원가입 | `frontend/src/pages/AuthPage.jsx` | `/api/auth/signup`, `/api/auth/login` |
| 시험 목록 | `frontend/src/applicant/ExamTab.jsx` | `/api/exams` |
| 공지사항 | `frontend/src/applicant/NoticeTab.jsx` | `/api/notices` |
| 시험 생성 | `frontend/src/admin/ExamCreateTab.jsx` | `/api/admin/exams` |
| 응시자 관리 | `frontend/src/admin/UserMgmtTab.jsx` | `/api/admin/users` |
| 실시간 관제 | `frontend/src/supervisor/LiveMonitoringTab.jsx` | `/api/supervisor/examinees`, `/warnings` |

## 기능을 추가하는 방법

새 기능은 아래 순서로 작업하면 프론트와 백엔드가 어긋나는 일을 줄일 수 있습니다.

1. 필요한 데이터와 API 요청·응답 형식을 먼저 정합니다.
2. `backend/src/app.mjs`에 API를 추가하고, 필요한 데이터 저장 로직은 `backend/src/store.mjs`에 추가합니다.
3. 권한이 필요한 API는 `authenticate`와 `requireRole(...)`을 적용합니다.
4. `backend/test/api.test.mjs`에 성공, 권한 없음, 잘못된 입력 테스트를 추가합니다.
5. `frontend/src/api/client.js`의 `api`와 `authHeaders()`를 사용해 화면을 연결합니다.
6. 백엔드 테스트와 프론트 빌드를 실행합니다.

예를 들어 관리자가 공지사항을 등록하는 기능을 추가한다면 다음이 필요합니다.

- `POST /api/admin/notices` API 추가
- 관리자 권한 검사
- 저장소의 공지 데이터 추가 함수
- 관리자 공지 작성 화면
- 응시자 공지 목록에서 새 데이터 표시
- 성공·권한 없음·빈 입력에 대한 API 테스트

## 검증 명령어

```bash
# 백엔드 API 테스트
cd backend
npm test
```

```bash
# 프론트 프로덕션 빌드
cd frontend
npm run build
```

```bash
# 프론트 정적 검사
cd frontend
npm run lint
```

## 운영 DB 전환 계획

현재 기능과 화면 흐름이 안정된 뒤에는 `database.json`을 MySQL 또는 PostgreSQL로 교체합니다. 사용자, 시험, 응시 기록, 부정행위 로그처럼 관계가 많은 서비스이므로 PostgreSQL을 우선 추천합니다.

전환 시에는 JSON 저장소 역할을 DB 접근 계층으로 교체하고, 데이터베이스 마이그레이션과 환경 변수 기반 연결 정보를 추가합니다. 프론트의 API 주소와 화면 호출 방식은 유지할 수 있도록 API 응답 형식을 먼저 안정화하는 것이 중요합니다.
