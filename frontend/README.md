# 🚀 AI 리터러시 역량 테스트 플랫폼 (Frontend)

KT AIVLE School 9기 빅프로젝트 23조에서 개발한 **실시간 지능형 감시 시스템과 자동 채점 파이프라인을 탑재한 개발자 역량 평가 플랫폼**의 프론트엔드 리포지토리입니다.

---

## 🛠️ Tech Stack

* **Framework:** React (Vite)
* **Routing:** React Router v6 (`react-router-dom`)
* **Styling:** Custom CSS (`main.css`), Flexbox/Grid Layout
* **Icons:** Lucide React

---

## 📂 Project Architecture (폴더 구조)

프로젝트 유지보수성과 확장성을 위해 컴포넌트들을 역할별(관리자/응시자)로 모듈화하였습니다.

```text
src/
 ├── assets/                 # 이미지 및 정적 리소스
 ├── components/             # 공통 및 권한별 하위 컴포넌트
 │    ├── Header.jsx         # 상단 네비게이션 바 (권한별 동적 탭 렌더링)
 │    ├── admin/             # 관리자 전용 탭 컴포넌트
 │    │    ├── ExamCreateTab.jsx    # 1. 시험 생성 및 일정 관리
 │    │    ├── PolicyMgmtTab.jsx    # 2. 문제 및 정책 관리
 │    │    ├── UserMgmtTab.jsx      # 3. 응시자 명단 및 권한 관리
 │    │    ├── CheatMgmtTab.jsx     # 4. 부정행위 금지사항 정책 관리
 │    │    └── AiConfigTab.jsx      # 5. LLM 및 AI 분석 설정
 │    └── applicant/         # 응시자/게스트 전용 탭 컴포넌트
 │         ├── HomeTab.jsx          # 플랫폼 소개 및 메인 그래픽 허브
 │         ├── ExamTab.jsx          # 정규 평가 목록 및 입장
 │         ├── CheckTab.jsx         # 사전 장비 및 WebRTC 환경 점검
 │         ├── PracticeTab.jsx      # 모의 연습문제 세션
 │         ├── NoticeTab.jsx        # 공지사항
 │         └── FaqTab.jsx           # 자주 묻는 질문
 ├── pages/                  # 페이지 레벨 컴포넌트
 │    ├── HomePage.jsx       # 메인 라우팅 허브 (URL 쿼리 파라미터 기반 탭 제어)
 │    └── AuthPage.jsx       # 로그인 / 회원가입 페이지
 ├── styles/
 │    └── main.css           # 전역 스타일 및 초기화, 컴포넌트별 디자인
 ├── App.jsx                 # 라우터 설정 및 전체 레이아웃 래퍼
 └── main.jsx                # 애플리케이션 진입점
```

## ✨ Key Features (주요 기능)

### 1. 역할 기반 접근 제어 (RBAC) 및 동적 네비게이션
* **관리자 (`ADMIN`)**
    * 로그인 시 상단 네비게이션 바가 관리자 콘솔 전용 5대 탭으로 자동 전환됩니다.
    * 시스템 전반의 시험 환경과 정책을 조율할 수 있습니다.
* **응시자 / 게스트 (`APPLICANT` / `GUEST`)**
    * 플랫폼 소개 홈, 평가 목록, 시험 점검, 연습문제, 공지사항, FAQ 탭을 이용할 수 있습니다.
    * 비회원 상태로 민감한 기능(시험 입장 등) 접근 시 로그인 유도 가이드 및 경고 배지가 작동합니다.

### 2. 관리자 서비스 플로우
* **시험 생성 (`Exam Create`)**
    * 새로운 코딩 테스트 세션의 명칭, 제한 시간, 문항 수 및 응시 기간(시작/마감 일시)을 설정하고 등록합니다.
* **문제 및 정책 관리 (`Policy Management`)**
    * 코딩 테스트 문제 세트 등록 및 컴파일러 허용 언어 규정, 배점 등을 관리합니다.
* **응시자 관리 (`User Management`)**
    * 응시 대기자 승인 상태 확인, 명단 조회 및 계정 권한을 수정합니다.
* **금지사항 관리 (`Cheating Prevention Policy`)**
    * AI 실시간 감독 시 감지할 부정행위 항목(웹캠 시선 이탈, 이어폰/헤드셋 착용, 브라우저 화면 이탈 등)의 패널티 및 제재 기준을 설정합니다.
* **AI 분석 설정 (`AI Analysis Configuration`)**
    * 코드 자동 채점을 위한 LLM 모델 선택(GPT-4o, Claude 등) 및 웹캠 AI 감독 민감도(Threshold)를 슬라이더로 조절합니다.

### 3. 응시자 서비스 플로우
* **플랫폼 홈 안내 (`Home`)**
    * 플랫폼 소개 및 AI 리터러시 역량 테스트의 주요 특징을 확인할 수 있습니다.
* **사전 장비 및 환경 점검 (`Device Check`)**
    * 실제 시험 전 웹캠, 마이크, 화면 공유, 모바일 QR 연동 등 WebRTC 통신 및 기기 상태를 진단합니다.
* **모의 연습문제 체험 (`Practice`)**
    * 실시간 AI 감독 환경을 미리 경험할 수 있는 연습문제 세션을 제공합니다.
* **정규 평가 응시 (`Exam`)**
    * 제한 시간 및 문항 수가 설정된 정규 역량 평가 시험에 입장하여 코딩 테스트를 수행합니다.
* **공지사항 및 FAQ (`Notice & FAQ`)**
    * 시험 응시 전 필수 독려 사항, 보조 카메라 거치 가이드, 자주 묻는 질문을 확인합니다.