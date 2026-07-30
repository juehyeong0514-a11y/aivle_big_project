export const seedData = {
  users: [
    { id: "user-applicant", name: "응시자", email: "applicant@aivle.com", role: "APPLICANT", password: "123", approvalStatus: "APPROVED" },
    { id: "user-supervisor", name: "김관리자", email: "supervisor@aivle.com", role: "MANAGER", password: "123", approvalStatus: "APPROVED", organizationIds: ["org-aivle-cs"] },
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
      date: "2026.07.20 ~ 2026.07.22",
      organizationId: "org-aivle-cs"
    }
  ],
  notices: [
    { id: "notice-browser", title: "[필수 독려] 시험 응시 전 PC 크롬(Chrome) 브라우저 최신 업데이트 안내", date: "2026.07.18" },
    { id: "notice-camera", title: "보조 카메라(스마트폰) 거치 각도 및 QR 연결 가이드라인", date: "2026.07.15" }
  ],
  examinees: [
    { id: "examinee-1", name: "김응시", organizationId: "org-aivle-cs", examId: "exam-2026-second-half", status: "NORMAL", statusText: "정상 응시 중", currentProb: "문제 2번" },
    { id: "examinee-2", name: "이수험", organizationId: "org-aivle-cs", examId: "exam-2026-second-half", status: "WARNING", statusText: "시선 이탈 감지", currentProb: "문제 1번" },
    { id: "examinee-3", name: "박개발", organizationId: "org-data-lab", status: "DANGER", statusText: "이어폰 착용 의심", currentProb: "문제 3번" },
    { id: "examinee-4", name: "최코딩", organizationId: "org-data-lab", status: "NORMAL", statusText: "정상 응시 중", currentProb: "문제 4번 제출완료" }
  ],
  warnings: []
  ,organizations: [
    { id: "org-aivle-cs", name: "A대학교 컴퓨터공학과", code: "AIVLE-CS", status: "APPROVED", requestedBy: "user-supervisor", managerIds: ["user-supervisor"], createdAt: "2026-07-20T09:00:00.000Z" },
    { id: "org-data-lab", name: "B대학교 데이터사이언스센터", code: "B-DATA", status: "PENDING", requestedBy: "user-supervisor", managerIds: [], createdAt: "2026-07-22T09:00:00.000Z" }
  ],
  candidates: [
    { id: "candidate-1", name: "홍길동", email: "applicant1@aivle.com", birthDate: "2000-01-01", organizationId: "org-aivle-cs", candidateNumber: "AIVLE-1001", status: "REGISTERED", createdAt: "2026-07-20T09:10:00.000Z" }
  ],
  questions: [
    { id: "question-seed-1", examId: "exam-2026-second-half", prompt: "2 + 2 = ?", options: ["3", "4", "5"], answer: "4", createdAt: "2026-07-20T09:20:00.000Z" },
    { id: "question-seed-2", examId: "exam-2026-second-half", prompt: "JavaScript에서 불변 배열을 만들 때 사용하는 메서드는?", options: ["map", "push", "splice"], answer: "map", createdAt: "2026-07-20T09:21:00.000Z" }
  ],
  assignments: [
    { id: "assignment-1", examId: "exam-2026-second-half", candidateId: "candidate-1", status: "INVITED" }
  ],
  invitations: [],
  invitationAuditLogs: [],
  organizationAiPolicies: {},
  systemPolicies: {
    invitationExpiryHours: 24,
    invitationSecurity: { revokePreviousOnResend: true, blockAfterSubmission: true, maxVerificationAttempts: 5, verificationLockoutMinutes: 15 },
    aiAnalysisEnabled: true,
    aiProvider: "OpenAI",
    aiModel: "gpt-4o-mini",
    cheatDetection: { gazeWarningEnabled: true, audioDetectionEnabled: true, tabSwitchSubmitEnabled: true }
  },
  emailVerifications: []
};
