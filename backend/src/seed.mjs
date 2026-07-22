export const seedData = {
  users: [
    { id: "user-applicant", name: "응시자", email: "applicant@aivle.com", role: "APPLICANT", password: "123", approvalStatus: "APPROVED" },
    { id: "user-supervisor", name: "감독관", email: "supervisor@aivle.com", role: "SUPERVISOR", password: "123", approvalStatus: "APPROVED" },
    { id: "user-admin", name: "관리자", email: "admin@aivle.com", role: "ADMIN", password: "123", approvalStatus: "APPROVED" },
    { id: "user-candidate-1", name: "홍길동", email: "applicant1@aivle.com", role: "APPLICANT", password: "123", approvalStatus: "APPROVED" }
  ],
  exams: [
    {
      id: "exam-2026-second-half",
      title: "2026년 하반기 신입 공채 AI 리터러시 역량 평가",
      category: "정규 평가 (Python / Java / C++)",
      duration: "90분",
      questions: "총 4문제",
      status: "AVAILABLE",
      date: "2026.07.20 ~ 2026.07.22"
    }
  ],
  notices: [
    { id: "notice-browser", title: "[필수 독려] 시험 응시 전 PC 크롬(Chrome) 브라우저 최신 업데이트 안내", date: "2026.07.18" },
    { id: "notice-camera", title: "보조 카메라(스마트폰) 거치 각도 및 QR 연결 가이드라인", date: "2026.07.15" }
  ],
  examinees: [
    { id: "examinee-1", name: "김응시", status: "NORMAL", statusText: "정상 응시 중", currentProb: "문제 2번" },
    { id: "examinee-2", name: "이수험", status: "WARNING", statusText: "시선 이탈 감지", currentProb: "문제 1번" },
    { id: "examinee-3", name: "박개발", status: "DANGER", statusText: "이어폰 착용 의심", currentProb: "문제 3번" },
    { id: "examinee-4", name: "최코딩", status: "NORMAL", statusText: "정상 응시 중", currentProb: "문제 4번 제출완료" }
  ],
  warnings: []
};
