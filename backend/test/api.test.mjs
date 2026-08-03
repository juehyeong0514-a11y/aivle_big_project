import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp, resolveCodeExecutionAllowedHosts, resolveCodeExecutionUrl } from "../src/app.mjs";
import { createStore } from "../src/store.mjs";

const startServer = async (options = {}) => {
  const directory = await mkdtemp(join(tmpdir(), "aivle-api-"));
  const app = await createApp({ ...options, databasePath: join(directory, "database.json") });
  const server = app.listen(0);
  await new Promise((resolveReady) => server.once("listening", resolveReady));
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, directory, server };
};

const signupManager = async (baseUrl, email, name = "신규 조직 관리자") => {
  const send = await fetch(`${baseUrl}/api/auth/email-verification/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  const sendPayload = await send.json();
  const confirm = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, verificationId: sendPayload.verificationId, code: sendPayload.previewCode }) });
  const confirmPayload = await confirm.json();
  return fetch(`${baseUrl}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password: "safe-password", verificationToken: confirmPayload.verificationToken }) });
};

test("updates an exam schedule across invitations and removes the exam graph", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" }) });
  const manager = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };
  const created = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers, body: JSON.stringify({ organizationId: "org-aivle-cs", title: "Schedule update test", duration: "60분", questions: "총 1문제", date: "2099.10.10 10:00" }) });
  assert.equal(created.status, 201);
  const exam = await created.json();
  const assignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers, body: JSON.stringify({ candidateIds: ["candidate-1"] }) });
  assert.equal(assignment.status, 201);
  const sent = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/invitations/send`, { method: "POST", headers, body: JSON.stringify({ candidateIds: ["candidate-1"] }) });
  assert.equal(sent.status, 201);
  const invitation = await sent.json();
  const token = new URL(invitation.mailPreviews[0].entryLink).searchParams.get("token");

  const invalidDate = await fetch(`${baseUrl}/api/manager/exams/${exam.id}`, { method: "PATCH", headers, body: JSON.stringify({ date: "2099.99.99 99:99" }) });
  assert.equal(invalidDate.status, 400);
  const updated = await fetch(`${baseUrl}/api/manager/exams/${exam.id}`, { method: "PATCH", headers, body: JSON.stringify({ date: "2099.10.11 12:00" }) });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).date, "2099.10.11 12:00");
  const invitationPreviewInfo = await fetch(`${baseUrl}/api/invitations/${token}`);
  assert.equal(invitationPreviewInfo.status, 200);
  assert.equal((await invitationPreviewInfo.json()).schedule, "2099.10.11 12:00");
  const managerInvitations = await fetch(`${baseUrl}/api/manager/invitations`, { headers: { Authorization: `Bearer ${manager.token}` } });
  const refreshedInvitation = (await managerInvitations.json()).find((item) => item.examId === exam.id);
  assert.equal(Date.parse(refreshedInvitation.expiresAt), new Date(2099, 9, 11, 13, 0).getTime());

  const verified = await fetch(`${baseUrl}/api/invitations/${token}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: "AIVLE-1001" }) });
  assert.equal(verified.status, 200);
  const applicant = await verified.json();
  const applicantHeaders = { Authorization: `Bearer ${applicant.accessToken}` };
  const deviceResponse = await fetch(`${baseUrl}/api/applicant/auxiliary-devices`, { method: "POST", headers: applicantHeaders });
  assert.equal(deviceResponse.status, 201);
  const device = await deviceResponse.json();
  const paired = await fetch(`${baseUrl}/api/mobile-devices/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: device.token }) });
  assert.equal(paired.status, 200);
  const deviceToken = (await paired.json()).deviceToken;

  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@aivle.com", password: "123", role: "ADMIN" }) });
  const admin = await adminLogin.json();
  const adminHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` };
  const revoked = await fetch(`${baseUrl}/api/admin/invitations/${refreshedInvitation.id}/revoke`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ reason: "삭제 연동 테스트" }) });
  assert.equal(revoked.status, 200);

  const removed = await fetch(`${baseUrl}/api/manager/exams/${exam.id}`, { method: "DELETE", headers });
  assert.equal(removed.status, 204);
  const examsAfterDelete = await fetch(`${baseUrl}/api/manager/exams`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.equal((await examsAfterDelete.json()).some((item) => item.id === exam.id), false);
  assert.equal((await fetch(`${baseUrl}/api/invitations/${token}`)).status, 410);
  assert.equal((await fetch(`${baseUrl}/api/applicant/session`, { headers: applicantHeaders })).status, 401);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/mobile-devices/${deviceToken}/status`)).json(), { ended: true });
  const auditLogs = await fetch(`${baseUrl}/api/admin/invitation-audit-logs`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal((await auditLogs.json()).some((log) => log.invitationId === refreshedInvitation.id), true);
});

test("uses the public Judge0 demo endpoint when production execution env is absent", () => {
  assert.equal(resolveCodeExecutionUrl("", true), "https://ce.judge0.com");
  assert.deepEqual(resolveCodeExecutionAllowedHosts("", true), ["ce.judge0.com"]);
});

test("allows browser preflight for applicant media status PUT requests", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());

  const preflight = await fetch(`${baseUrl}/api/applicant/media-status`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "authorization,content-type"
    }
  });

  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /(?:^|,)PUT(?:,|$)/);
});

test("updates objective questions and blocks question deletion after an invitation is sent", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" }) });
  const manager = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };
  const organizations = await fetch(`${baseUrl}/api/manager/organizations`, { headers });
  const organization = (await organizations.json()).find((item) => item.status === "APPROVED" && item.canManage);
  const examResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers, body: JSON.stringify({ organizationId: organization.id, title: "문제 CRUD 시험", duration: "30분", questions: "2문제", date: "2099.06.01 10:00" }) });
  const exam = await examResponse.json();
  const createQuestion = async (prompt) => fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions`, { method: "POST", headers, body: JSON.stringify({ type: "MULTIPLE_CHOICE", prompt, options: ["1", "2"], answer: "2" }) });
  const questionResponse = await createQuestion("수정 전 문제");
  assert.equal(questionResponse.status, 201);
  const question = await questionResponse.json();
  const update = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions/${question.id}`, { method: "PATCH", headers, body: JSON.stringify({ type: "MULTIPLE_CHOICE", prompt: "수정 후 문제", options: ["A", "B", "C"], answer: "B" }) });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).prompt, "수정 후 문제");
  const deletion = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions/${question.id}`, { method: "DELETE", headers });
  assert.equal(deletion.status, 204);
  const missing = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions/${question.id}`, { method: "DELETE", headers });
  assert.equal(missing.status, 404);

  const protectedQuestion = await createQuestion("초대 후 보호되는 문제");
  const protectedQuestionData = await protectedQuestion.json();
  const candidateResponse = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers, body: JSON.stringify({ organizationId: organization.id, name: "초대 대상", email: "question-delete@example.com", birthDate: "2000-01-01" }) });
  const candidate = await candidateResponse.json();
  await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  const invitation = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/invitations/send`, { method: "POST", headers, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  assert.equal(invitation.status, 201);
  const blocked = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions/${protectedQuestionData.id}`, { method: "DELETE", headers });
  assert.equal(blocked.status, 409);
});

test("serves public data and protects administration endpoints", async (context) => {
  const { baseUrl, directory, server } = await startServer();
  context.after(() => server.close());

  const exams = await fetch(`${baseUrl}/api/exams`);
  assert.equal(exams.status, 403);
  assert.match((await exams.json()).message, /초대 메일/);

  const denied = await fetch(`${baseUrl}/api/admin/users`);
  assert.equal(denied.status, 401);

  const signup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "신규 응시자", email: "new-applicant@aivle.com", password: "safe-password", role: "APPLICANT" })
  });
  assert.equal(signup.status, 400);
  assert.match((await signup.json()).message, /회원가입/);

  const database = JSON.parse(await readFile(join(directory, "database.json"), "utf8"));
  assert.equal(database.users.some((user) => user.email === "new-applicant@aivle.com"), false);

  const privilegedSignup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "권한 상승 시도", email: "blocked-admin@aivle.com", password: "safe-password", role: "ADMIN" })
  });
  assert.equal(privilegedSignup.status, 400);

  const accountLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aivle.com", password: "123" })
  });
  assert.equal(accountLogin.status, 200);
  assert.equal((await accountLogin.json()).user.role, "ADMIN");
  const managerLogin = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" }) });
  const manager = await managerLogin.json();
  const assignedSeedExaminees = await fetch(`${baseUrl}/api/supervisor/examinees?examId=exam-2026-second-half`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.equal(assignedSeedExaminees.status, 200);
  assert.equal((await assignedSeedExaminees.json()).some((item) => item.candidateId === "candidate-1"), true);
});

test("allows ADMIN to manage searchable and scheduled public notices", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aivle.com", password: "123" })
  });
  const { token } = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const denied = await fetch(`${baseUrl}/api/admin/notices`);
  assert.equal(denied.status, 401);

  const created = await fetch(`${baseUrl}/api/admin/notices`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "긴급 점검 안내", content: "오늘 18시에 점검합니다.", category: "URGENT", pinned: true })
  });
  assert.equal(created.status, 201);
  const notice = await created.json();
  assert.equal(notice.pinned, true);

  const search = await fetch(`${baseUrl}/api/notices?q=18시&category=URGENT`);
  assert.equal(search.status, 200);
  assert.equal((await search.json()).some((item) => item.id === notice.id), true);

  const detail = await fetch(`${baseUrl}/api/notices/${notice.id}`);
  assert.equal((await detail.json()).viewCount, 1);

  const updated = await fetch(`${baseUrl}/api/admin/notices/${notice.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title: "긴급 점검 시간 변경", content: "오늘 19시에 점검합니다.", category: "MAINTENANCE" })
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).title, "긴급 점검 시간 변경");

  const removed = await fetch(`${baseUrl}/api/admin/notices/${notice.id}`, { method: "DELETE", headers });
  assert.equal(removed.status, 204);
  assert.equal((await fetch(`${baseUrl}/api/notices/${notice.id}`)).status, 404);
});

test("scopes manager notices to assigned organizations and exams", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" })
  });
  const { token } = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const examResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers, body: JSON.stringify({ organizationId: "org-aivle-cs", title: "공지 범위 시험", duration: "60분", questions: "1문제", date: "2099.05.01 10:00" }) });
  const exam = await examResponse.json();
  assert.equal(examResponse.status, 201);
  const assignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers, body: JSON.stringify({ candidateIds: ["candidate-1"] }) });
  assert.equal(assignment.status, 201);

  const created = await fetch(`${baseUrl}/api/manager/notices`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "조직 응시 안내",
      content: "시험 시작 전에 장비 점검을 완료해주세요.",
      category: "EXAM",
      scope: "EXAM",
      organizationId: "org-aivle-cs",
      examId: exam.id
    })
  });
  assert.equal(created.status, 201);
  const notice = await created.json();
  assert.equal(notice.scope, "EXAM");
  assert.equal(notice.organizationId, "org-aivle-cs");

  const publicNotices = await fetch(`${baseUrl}/api/notices`);
  assert.equal((await publicNotices.json()).some((item) => item.id === notice.id), false);

  const invitationResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/invitations/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ candidateIds: ["candidate-1"] })
  });
  assert.equal(invitationResponse.status, 201);
  const invitation = await invitationResponse.json();
  const invitationToken = new URL(invitation.mailPreviews[0].entryLink).searchParams.get("token");
  const invitationNotices = await fetch(`${baseUrl}/api/invitations/${invitationToken}/notices`);
  assert.equal((await invitationNotices.json()).some((item) => item.id === notice.id), true);
  const invitationDetail = await fetch(`${baseUrl}/api/invitations/${invitationToken}/notices/${notice.id}`);
  assert.equal(invitationDetail.status, 200);
  assert.equal((await invitationDetail.json()).id, notice.id);

  const denied = await fetch(`${baseUrl}/api/manager/notices`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "다른 조직 공지",
      content: "등록되면 안 됩니다.",
      scope: "ORGANIZATION",
      organizationId: "org-data-lab"
    })
  });
  assert.equal(denied.status, 403);

  const managed = await fetch(`${baseUrl}/api/manager/notices`, { headers });
  assert.equal((await managed.json()).some((item) => item.id === notice.id), true);
});

test("scopes community posts and comments to a manager organization", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());

  const managerLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" })
  });
  const manager = await managerLogin.json();
  const managerHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };

  const created = await fetch(`${baseUrl}/api/manager/community`, {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({
      title: "시험 환경 질문",
      content: "화면 공유는 언제 시작하나요?",
      category: "QUESTION",
      organizationId: "org-aivle-cs",
      examId: "exam-2026-second-half"
    })
  });
  assert.equal(created.status, 201);
  const post = await created.json();
  assert.equal(post.organizationId, "org-aivle-cs");

  const comment = await fetch(`${baseUrl}/api/manager/community/${post.id}/comments`, {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({ content: "사전 환경 점검 단계에서 시작합니다." })
  });
  assert.equal(comment.status, 201);

  const detail = await fetch(`${baseUrl}/api/manager/community/${post.id}`, { headers: managerHeaders });
  const detailPayload = await detail.json();
  assert.equal(detailPayload.comments.length, 1);
  assert.equal(detailPayload.commentCount, 1);

  const denied = await fetch(`${baseUrl}/api/manager/community`, {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({ title: "다른 조직 글", content: "등록 불가", organizationId: "org-data-lab" })
  });
  assert.equal(denied.status, 403);

  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aivle.com", password: "123" })
  });
  const admin = await adminLogin.json();
  const adminList = await fetch(`${baseUrl}/api/admin/community`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal((await adminList.json()).some((item) => item.id === post.id), true);
});

test("registers managers for ADMIN approval before login", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const signup = await signupManager(baseUrl, "new-manager@example.com");
  assert.equal(signup.status, 201);
  const pendingLogin = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "new-manager@example.com", password: "safe-password" }) });
  assert.equal(pendingLogin.status, 403);
  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@aivle.com", password: "123" }) });
  const admin = await adminLogin.json();
  const users = await fetch(`${baseUrl}/api/admin/users`, { headers: { Authorization: `Bearer ${admin.token}` } });
  const manager = (await users.json()).find((user) => user.email === "new-manager@example.com");
  const approval = await fetch(`${baseUrl}/api/admin/users/${manager.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ status: "APPROVED" }) });
  assert.equal(approval.status, 200);
  const approvedLogin = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "new-manager@example.com", password: "safe-password" }) });
  assert.equal(approvedLogin.status, 200);
});

test("requires email verification before manager signup and rate-limits invalid codes", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const unverified = await fetch(`${baseUrl}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "미인증 관리자", email: "unverified@example.com", password: "safe-password" }) });
  assert.equal(unverified.status, 400);
  const send = await fetch(`${baseUrl}/api/auth/email-verification/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "verified@example.com" }) });
  const payload = await send.json();
  assert.equal(send.status, 201);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invalid = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "verified@example.com", verificationId: payload.verificationId, code: "000000" }) });
    assert.equal(invalid.status, 401);
  }
  const locked = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "verified@example.com", verificationId: payload.verificationId, code: payload.previewCode }) });
  assert.equal(locked.status, 429);
});

test("governs organization approval, manager scope, and invitations reusable before submission", async (context) => {
  const { baseUrl, directory, server } = await startServer({ aiProctorOptions: {
    endpoint: "http://ai-proctor.test",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ model: "fake-yolo", latencyMs: 5, personCount: 1, detections: [{ label: "cell phone", confidence: .9, bbox: [.1, .1, .3, .4] }], events: [{ type: "CELL_PHONE_DETECTED", confidence: .9, message: "감지" }] }) })
  } });
  context.after(() => server.close());
  const login = async (email, role, password = "123") => {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) });
    return response.json();
  };
  const admin = await login("admin@aivle.com", "ADMIN");
  const adminHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` };
  const managerCreation = await fetch(`${baseUrl}/api/admin/managers`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "신관리자", email: "manager2@aivle.com", password: "safe-password" }) });
  assert.equal(managerCreation.status, 201);
  const managersAfterCreation = await fetch(`${baseUrl}/api/admin/users`, { headers: { Authorization: `Bearer ${admin.token}` } });
  const managerPayload = (await managersAfterCreation.json()).find((user) => user.email === "manager2@aivle.com");
  const manager = await login("manager2@aivle.com", "MANAGER", "safe-password");
  const managerHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };
  const requestOrganization = await fetch(`${baseUrl}/api/manager/organizations`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ name: "C대학교 AI학과", code: "C-AI" }) });
  const organization = await requestOrganization.json();
  assert.equal(organization.status, "PENDING");
  const approve = await fetch(`${baseUrl}/api/admin/organizations/${organization.id}/approve`, { method: "POST", headers: adminHeaders });
  assert.equal(approve.status, 200);
  const missingScheduleExam = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "일정 없는 평가", duration: "60분", questions: "총 1문제" }) });
  assert.equal(missingScheduleExam.status, 400);
  const afterApprovalExam = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "승인 후 평가", duration: "60분", questions: "총 1문제", date: "2099.07.01 10:00" }) });
  assert.equal(afterApprovalExam.status, 201);
  const organizations = await fetch(`${baseUrl}/api/admin/organizations`, { headers: { Authorization: `Bearer ${admin.token}` } });
  const managedOrganization = (await organizations.json()).find((candidate) => candidate.id === organization.id);
  assert.equal(managedOrganization.managers.length, 1);
  const outOfScopeCandidate = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: "org-aivle-cs", name: "범위 밖 응시자", email: "outside@example.com", birthDate: "2000-01-01" }) });
  assert.equal(outOfScopeCandidate.status, 403);
  const candidateResponse = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, name: "초대 응시자", email: "invitee@example.com", birthDate: "2000-01-01" }) });
  const candidate = await candidateResponse.json();
  assert.match(candidate.candidateNumber, /^AIVLE-/);
  const sameEmailInDifferentOrganizationResponse = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, name: "다른 조직 동명이인", email: "applicant1@aivle.com", birthDate: "2001-01-01" }) });
  assert.equal(sameEmailInDifferentOrganizationResponse.status, 201);
  const sameEmailInDifferentOrganization = await sameEmailInDifferentOrganizationResponse.json();
  const examResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "C 조직 평가", duration: "60분", questions: "총 5문제", date: "2099.08.01 10:00" }) });
  assert.equal(examResponse.status, 201);
  const exam = await examResponse.json();
  const supervisor = await login("supervisor@aivle.com", "MANAGER");
  const crossOrganizationResults = await fetch(`${baseUrl}/api/manager/results?examId=${exam.id}`, { headers: { Authorization: `Bearer ${supervisor.token}` } });
  assert.equal(crossOrganizationResults.status, 403);
  const crossOrganizationExams = await fetch(`${baseUrl}/api/supervisor/exams?organizationId=${organization.id}`, { headers: { Authorization: `Bearer ${supervisor.token}` } });
  assert.equal(crossOrganizationExams.status, 403);
  const crossOrganizationExaminees = await fetch(`${baseUrl}/api/supervisor/examinees?organizationId=${organization.id}`, { headers: { Authorization: `Bearer ${supervisor.token}` } });
  assert.equal(crossOrganizationExaminees.status, 403);
  const crossOrganizationWarnings = await fetch(`${baseUrl}/api/supervisor/warnings?organizationId=${organization.id}`, { headers: { Authorization: `Bearer ${supervisor.token}` } });
  assert.equal(crossOrganizationWarnings.status, 403);
  const managerExams = await fetch(`${baseUrl}/api/manager/exams`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.ok((await managerExams.json()).some((candidate) => candidate.id === exam.id));
  const invalidQuestion = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ prompt: "invalid", options: ["A", "B"], answer: "C" }) });
  assert.equal(invalidQuestion.status, 400);
  const questionResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ prompt: "2 + 2 = ?", options: ["3", "4"], answer: "4" }) });
  assert.equal(questionResponse.status, 201);
  const assignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  assert.equal(assignment.status, 201);
  const sameNameAssignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [sameEmailInDifferentOrganization.id, sameEmailInDifferentOrganization.id] }) });
  assert.equal(sameNameAssignment.status, 201);
  const removeSameNameAssignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assignments`, { method: "DELETE", headers: managerHeaders, body: JSON.stringify({ candidateIds: [sameEmailInDifferentOrganization.id] }) });
  assert.equal(removeSameNameAssignment.status, 200);
  const assignedBeforeEntry = await fetch(`${baseUrl}/api/supervisor/examinees?examId=${exam.id}`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.equal(assignedBeforeEntry.status, 200);
  assert.equal((await assignedBeforeEntry.json()).some((item) => item.candidateId === candidate.id && item.status === "NOT_STARTED"), true);
  const secondExamResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "분리 대상자 평가", duration: "60분", questions: "총 1문제", date: "2026.08.02 10:00" }) });
  assert.equal(secondExamResponse.status, 201);
  const secondExam = await secondExamResponse.json();
  const firstExamCandidates = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/candidates`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.equal(firstExamCandidates.status, 200);
  assert.deepEqual((await firstExamCandidates.json()).map((item) => item.id), [candidate.id]);
  const secondExamCandidates = await fetch(`${baseUrl}/api/manager/exams/${secondExam.id}/candidates`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.equal(secondExamCandidates.status, 200);
  assert.deepEqual(await secondExamCandidates.json(), []);
  const removableCandidateResponse = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, name: "Remove Before Invite", email: "remove-before-invite@example.com", birthDate: "2000-01-01" }) });
  const removableCandidate = await removableCandidateResponse.json();
  const removableAssignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [removableCandidate.id] }) });
  assert.equal(removableAssignment.status, 201);
  const removeAssignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assignments`, { method: "DELETE", headers: managerHeaders, body: JSON.stringify({ candidateIds: [removableCandidate.id] }) });
  assert.equal(removeAssignment.status, 200);
  assert.equal((await removeAssignment.json()).removedCount, 1);
  const deleteCandidate = await fetch(`${baseUrl}/api/manager/candidates/${removableCandidate.id}`, { method: "DELETE", headers: managerHeaders });
  assert.equal(deleteCandidate.status, 200);
  const candidatesAfterDelete = await fetch(`${baseUrl}/api/manager/candidates`, { headers: managerHeaders });
  assert.equal((await candidatesAfterDelete.json()).some((item) => item.id === removableCandidate.id), false);
  const batchCandidateResponses = await Promise.all(["batch-one@example.com", "batch-two@example.com"].map((email, index) => fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, name: `일괄 삭제 ${index + 1}`, email, birthDate: "2000-01-01" }) })));
  const batchCandidates = await Promise.all(batchCandidateResponses.map((response) => response.json()));
  const batchDelete = await fetch(`${baseUrl}/api/manager/candidates/batch-delete`, { method: "DELETE", headers: managerHeaders, body: JSON.stringify({ candidateIds: batchCandidates.map((item) => item.id) }) });
  assert.equal(batchDelete.status, 200);
  assert.equal((await batchDelete.json()).removedCount, 2);
  const outOfScopeDelete = await fetch(`${baseUrl}/api/manager/candidates/candidate-1`, { method: "DELETE", headers: managerHeaders });
  assert.equal(outOfScopeDelete.status, 403);
  const invitationResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/invitations/send`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id], expiresInHours: 1 }) });
  const invitation = await invitationResponse.json();
  assert.equal(invitation.count, 1);
  assert.equal(invitation.deliveryStatus, "PREVIEW");
  assert.equal(invitation.mailPreviews[0].oneTimeToken, undefined);
  assert.equal(Date.parse(invitation.mailPreviews[0].expiresAt), new Date(2099, 7, 1, 11, 0).getTime());
  const entryUrl = new URL(invitation.mailPreviews[0].entryLink);
  assert.equal(entryUrl.origin, "http://localhost:5173");
  assert.equal(entryUrl.pathname, "/exam/enter");
  const token = entryUrl.searchParams.get("token");
  assert.ok(token);
  const invitationInfo = await fetch(`${baseUrl}/api/invitations/${token}`);
  assert.equal(invitationInfo.status, 200);
  assert.equal((await invitationInfo.json()).duration, "60분");

  const pastExamResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "과거 일정 시험", duration: "60분", questions: "총 1문제", date: "2000.01.01 10:00" }) });
  assert.equal(pastExamResponse.status, 201);
  const pastExam = await pastExamResponse.json();
  const pastAssignment = await fetch(`${baseUrl}/api/manager/exams/${pastExam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  assert.equal(pastAssignment.status, 201);
  const pastInvitationResponse = await fetch(`${baseUrl}/api/manager/exams/${pastExam.id}/invitations/send`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  assert.equal(pastInvitationResponse.status, 409);
  assert.deepEqual(await pastInvitationResponse.json(), { message: "이미 종료된 시험에는 초대 링크를 발송할 수 없습니다." });

  const savedDatabase = JSON.parse(await readFile(join(directory, "database.json"), "utf8"));
  assert.equal(savedDatabase.invitations[0].token, undefined);
  assert.ok(savedDatabase.invitations[0].tokenHash);
  const verified = await fetch(`${baseUrl}/api/invitations/${token}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: candidate.candidateNumber }) });
  assert.equal(verified.status, 200);
  const applicantToken = (await verified.json()).accessToken;
  const revisit = await fetch(`${baseUrl}/api/invitations/${token}`);
  assert.equal(revisit.status, 200);
  const reverified = await fetch(`${baseUrl}/api/invitations/${token}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: candidate.candidateNumber }) });
  assert.equal(reverified.status, 200);
  const applicantSession = await fetch(`${baseUrl}/api/applicant/session`, { headers: { Authorization: `Bearer ${applicantToken}` } });
  assert.equal(applicantSession.status, 200);
  const examineesBeforeWarning = await fetch(`${baseUrl}/api/supervisor/examinees?examId=${exam.id}`, { headers: { Authorization: `Bearer ${manager.token}` } });
  const examinee = (await examineesBeforeWarning.json()).find((item) => item.candidateId === candidate.id);
  const warning = await fetch(`${baseUrl}/api/supervisor/examinees/${examinee.id}/warnings`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ examId: exam.id, message: "부정행위 여부를 확인해주세요." }) });
  assert.equal(warning.status, 201);
  const applicantWarnings = await fetch(`${baseUrl}/api/applicant/warnings`, { headers: { Authorization: `Bearer ${applicantToken}` } });
  assert.equal(applicantWarnings.status, 200);
  assert.equal(applicantWarnings.headers.get("cache-control"), "no-store");
  assert.deepEqual((await applicantWarnings.json()).map((item) => item.message), ["부정행위 여부를 확인해주세요."]);
  const snapshotHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${applicantToken}` };
  const uploadSnapshot = () => fetch(`${baseUrl}/api/applicant/monitoring-snapshot`, { method: "PUT", headers: snapshotHeaders, body: JSON.stringify({ image: "data:image/jpeg;base64,dGVzdA==" }) });
  assert.equal((await uploadSnapshot()).status, 204);
  assert.equal((await uploadSnapshot()).status, 204);
  let aiWarnings = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/applicant/warnings`, { headers: { Authorization: `Bearer ${applicantToken}` } });
    aiWarnings = (await response.json()).filter((item) => item.source === "AI");
    if (aiWarnings.length) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(aiWarnings.length, 1);
  assert.equal(aiWarnings[0].type, "CELL_PHONE_DETECTED");
  const supervisorWarnings = await fetch(`${baseUrl}/api/supervisor/warnings?examId=${exam.id}`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.equal((await supervisorWarnings.json()).some((item) => item.source === "AI" && item.confidence === .9), true);
  const applicantExam = await fetch(`${baseUrl}/api/applicant/exam`, { headers: { Authorization: `Bearer ${applicantToken}` } });
  const applicantExamPayload = await applicantExam.json();
  assert.equal(applicantExam.status, 200);
  assert.equal(applicantExamPayload.questions[0].answer, undefined);
  const submission = await fetch(`${baseUrl}/api/applicant/exam/submit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${applicantToken}` }, body: JSON.stringify({ answers: { [applicantExamPayload.questions[0].id]: "4" } }) });
  assert.equal(submission.status, 200);
  const duplicateSubmission = await fetch(`${baseUrl}/api/applicant/exam/submit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${applicantToken}` }, body: JSON.stringify({ answers: {} }) });
  assert.equal(duplicateSubmission.status, 409);
  const protectedRemoval = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assignments`, { method: "DELETE", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  assert.equal(protectedRemoval.status, 409);
  const reused = await fetch(`${baseUrl}/api/invitations/${token}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: candidate.candidateNumber }) });
  assert.equal(reused.status, 410);
  const scopedExaminees = await fetch(`${baseUrl}/api/supervisor/examinees`, { headers: { Authorization: `Bearer ${manager.token}` } });
  assert.equal(scopedExaminees.status, 200);
  assert.equal((await scopedExaminees.json()).some((examinee) => examinee.candidateId === candidate.id), true);
  const codingQuestionResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions`, {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({
      type: "CODING", title: "두 수의 합", languages: ["Python", "JavaScript"],
      description: "두 정수 A와 B를 입력받아 합을 출력하세요.", inputFormat: "첫째 줄에 정수 A와 B가 공백으로 주어집니다.", outputFormat: "A와 B의 합을 출력합니다.", constraints: "1 ≤ A, B ≤ 100",
      publicExamples: [{ input: "3 5", expectedOutput: "8", explanation: "두 수를 더합니다." }],
      hiddenTestCases: [{ input: "1 2", expectedOutput: "3" }], judgeMode: "IGNORE_WHITESPACE", referenceSolutions: { Python: "a, b = map(int, input().split())\nprint(a + b)" }
    })
  });
  assert.equal(codingQuestionResponse.status, 201);
  const codingQuestion = await codingQuestionResponse.json();
  assert.equal(codingQuestion.hiddenTestCases.length, 1);
  assert.equal(codingQuestion.difficulty, undefined);
  assert.equal(codingQuestion.timeLimitSeconds, undefined);
  assert.equal(codingQuestion.memoryLimitMb, undefined);
  const codingQuestionUpdate = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions/${codingQuestion.id}`, {
    method: "PATCH",
    headers: managerHeaders,
    body: JSON.stringify({ ...codingQuestion, type: "CODING", title: "두 수의 합 (수정)", hiddenTestCases: [{ input: "10 20", expectedOutput: "30" }] })
  });
  assert.equal(codingQuestionUpdate.status, 200);
  assert.equal((await codingQuestionUpdate.json()).title, "두 수의 합 (수정)");
  const codingApplicantExam = await fetch(`${baseUrl}/api/applicant/exam`, { headers: { Authorization: `Bearer ${applicantToken}` } });
  const codingApplicantQuestion = (await codingApplicantExam.json()).questions.find((item) => item.id === codingQuestion.id);
  assert.equal(codingApplicantQuestion.hiddenTestCases, undefined);
  assert.equal(codingApplicantQuestion.referenceSolutions, undefined);
  assert.equal(codingApplicantQuestion.publicExamples[0].expectedOutput, "8");
});

test("runs Python, Java, and C through the configured code execution server", async (context) => {
  const receivedLanguageIds = [];
  const executionSubmissions = new Map();
  const executionServer = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.method === "POST") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      receivedLanguageIds.push(payload.language_id);
      const token = `submission-${receivedLanguageIds.length}`;
      executionSubmissions.set(token, payload);
      response.end(JSON.stringify({ token }));
      return;
    }
    const token = decodeURIComponent(request.url.split("/")[2].split("?")[0]);
    const payload = executionSubmissions.get(token);
    response.end(JSON.stringify({ status: { id: 3, description: "Accepted" }, stdout: `echo:${payload.stdin}` }));
  });
  await new Promise((resolveReady) => executionServer.listen(0, "127.0.0.1", resolveReady));
  const executionAddress = executionServer.address();
  const { baseUrl, server } = await startServer({ codeExecutionUrl: `http://127.0.0.1:${executionAddress.port}` });
  context.after(() => {
    executionServer.close();
    server.close();
  });

  const managerLogin = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" }) });
  const manager = await managerLogin.json();
  const managerHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };
  const organizations = await fetch(`${baseUrl}/api/manager/organizations`, { headers: managerHeaders });
  const organization = (await organizations.json()).find((item) => item.status === "APPROVED" && item.canManage);
  const examResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "다국어 실행 시험", duration: "30분", questions: "1문제", date: "2099.09.01 10:00" }) });
  const exam = await examResponse.json();
  const questionResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/questions`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ type: "CODING", title: "합계", languages: ["Python", "Java", "C"], description: "두 수의 합을 출력하세요.", inputFormat: "A B", outputFormat: "합계", constraints: "정수", publicExamples: [{ input: "2 3", expectedOutput: "5" }], hiddenTestCases: [{ input: "1 2", expectedOutput: "3" }], judgeMode: "EXACT" }) });
  assert.equal(questionResponse.status, 201);
  const question = await questionResponse.json();
  assert.deepEqual(question.languages, ["Python", "Java", "C"]);
  const candidateResponse = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, name: "실행 테스트 응시자", email: "code-runner@example.com", birthDate: "2000-01-01" }) });
  const candidate = await candidateResponse.json();
  await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  const invitationResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/invitations/send`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id], expiresInHours: 1 }) });
  const invitation = await invitationResponse.json();
  const token = new URL(invitation.mailPreviews[0].entryLink).searchParams.get("token");
  const verified = await fetch(`${baseUrl}/api/invitations/${token}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: candidate.candidateNumber }) });
  const applicantToken = (await verified.json()).accessToken;

  for (const [language, source] of [["Python", "print(input())"], ["Java", "class Main { public static void main(String[] args) { System.out.println(1); } }"], ["C", "#include <stdio.h>\nint main(void) { puts(\"1\"); }"]]) {
    const run = await fetch(`${baseUrl}/api/applicant/exam/run`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${applicantToken}` }, body: JSON.stringify({ questionId: question.id, language, source, stdin: "2 3" }) });
    assert.equal(run.status, 200);
    const result = await run.json();
    assert.equal(result.type, "success");
    assert.equal(result.output, "echo:2 3");
  }
  const submitted = await fetch(`${baseUrl}/api/applicant/exam/submit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${applicantToken}` }, body: JSON.stringify({ answers: { [question.id]: { language: "C", source: "int main(void) { return 0; }" } } }) });
  assert.equal(submitted.status, 200);
  const rerunAfterSubmit = await fetch(`${baseUrl}/api/applicant/exam/run`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${applicantToken}` }, body: JSON.stringify({ questionId: question.id, language: "C", source: "int main(void) { return 0; }", stdin: "" }) });
  assert.equal(rerunAfterSubmit.status, 409);
  assert.deepEqual(receivedLanguageIds, [71, 62, 50]);
});

test("allows ADMIN to view the full exam directory without exam creation access", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aivle.com", password: "123", role: "ADMIN" })
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();

  const directory = await fetch(`${baseUrl}/api/admin/exams`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(directory.status, 200);
  assert.equal((await directory.json()).length, 1);

  const create = await fetch(`${baseUrl}/api/admin/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: "신규 평가", duration: "60분", questions: "총 3문제" })
  });
  assert.equal(create.status, 403);
  assert.match((await create.json()).message, /시험 생성/);
});

test("allows organization-code join approval and scopes monitoring by exam", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const login = async (email, role, password = "123") => {
    const response = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) });
    return response.json();
  };
  const admin = await login("admin@aivle.com", "ADMIN");
  const adminHeaders = { "Content-Type": "application/json", Authorization: "Bearer " + admin.token };
  const managerAResponse = await fetch(baseUrl + "/api/admin/managers", { method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "조직 관리자 A", email: "join-manager-a@example.com", password: "safe-password" }) });
  const managerA = (await managerAResponse.json()).user;
  const managerBResponse = await fetch(baseUrl + "/api/admin/managers", { method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "조직 관리자 B", email: "join-manager-b@example.com", password: "safe-password" }) });
  const managerB = (await managerBResponse.json()).user;
  const managerALogin = await login("join-manager-a@example.com", "MANAGER", "safe-password");
  const createOrganization = await fetch(baseUrl + "/api/manager/organizations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + managerALogin.token }, body: JSON.stringify({ name: "참여 테스트 조직", code: "JOIN-ORG" }) });
  const organization = await createOrganization.json();
  await fetch(baseUrl + "/api/admin/organizations/" + organization.id + "/approve", { method: "POST", headers: adminHeaders });
  await fetch(baseUrl + "/api/admin/organizations/" + organization.id + "/assign-manager", { method: "POST", headers: adminHeaders, body: JSON.stringify({ managerId: managerA.id }) });
  const managerBLogin = await login("join-manager-b@example.com", "MANAGER", "safe-password");
  const managerBHeaders = { "Content-Type": "application/json", Authorization: "Bearer " + managerBLogin.token };
  const join = await fetch(baseUrl + "/api/manager/organizations/join", { method: "POST", headers: managerBHeaders, body: JSON.stringify({ code: "join-org" }) });
  assert.equal(join.status, 201);
  const joinRequest = await join.json();
  const approveJoin = await fetch(baseUrl + "/api/manager/organization-join-requests/" + joinRequest.id + "/approve", { method: "POST", headers: { Authorization: "Bearer " + managerALogin.token } });
  assert.equal(approveJoin.status, 200);
  const managerBOrganizations = await fetch(baseUrl + "/api/manager/organizations", { headers: { Authorization: "Bearer " + managerBLogin.token } });
  assert.ok((await managerBOrganizations.json()).some((candidate) => candidate.id === organization.id));
  const supervisor = await login("supervisor@aivle.com", "MANAGER");
  const managerExams = await fetch(baseUrl + "/api/supervisor/exams", { headers: { Authorization: "Bearer " + supervisor.token } });
  const exams = await managerExams.json();
  assert.equal(managerExams.status, 200);
  assert.ok(exams.some((exam) => exam.id === "exam-2026-second-half"));
  const examinees = await fetch(baseUrl + "/api/supervisor/examinees?examId=exam-2026-second-half", { headers: { Authorization: "Bearer " + supervisor.token } });
  assert.equal(examinees.status, 200);
  const scopedExaminees = await examinees.json();
  assert.equal(scopedExaminees.length, 1);
  assert.equal(scopedExaminees[0].candidateId, "candidate-1");
});

test("removes plaintext passwords from an existing database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aivle-api-"));
  const databasePath = join(directory, "database.json");
  await writeFile(databasePath, JSON.stringify({
    users: [{ id: "legacy-user", email: "legacy@aivle.com", password: "legacy-secret", passwordHash: "kept" }],
    exams: [], notices: [], examinees: [], warnings: []
  }));

  await createStore(databasePath);

  const migratedDatabase = JSON.parse(await readFile(databasePath, "utf8"));
  assert.equal(migratedDatabase.users[0].password, undefined);
  assert.equal(migratedDatabase.users[0].passwordHash, "kept");
});

test("scopes exam policies to the supervising manager's organization", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const login = async (email, role) => (await (await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "123", role }) })).json());
  const supervisor = await login("supervisor@aivle.com", "MANAGER");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${supervisor.token}` };
  const initial = await fetch(`${baseUrl}/api/supervisor/exams/exam-2026-second-half/policies`, { headers });
  assert.equal(initial.status, 200);
  const policies = await initial.json();
  assert.equal(policies.invitationExpiryHours, undefined);
  const update = await fetch(`${baseUrl}/api/supervisor/exams/exam-2026-second-half/policies`, { method: "PATCH", headers, body: JSON.stringify({ ...policies, cheatDetection: { ...policies.cheatDetection, tabSwitchSubmitEnabled: false } }) });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).invitationExpiryHours, undefined);
  const persisted = await fetch(`${baseUrl}/api/supervisor/exams/exam-2026-second-half/policies`, { headers });
  assert.equal((await persisted.json()).cheatDetection.tabSwitchSubmitEnabled, false);
  const outOfScope = await fetch(`${baseUrl}/api/supervisor/exams/not-managed/policies`, { headers });
  assert.equal(outOfScope.status, 403);
  const adminPolicies = await fetch(`${baseUrl}/api/admin/policies`, { headers });
  assert.equal(adminPolicies.status, 403);
});

test("allows only ADMIN to govern invitation policies, inventory, audit logs, and emergency revocation", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const login = async (email, role) => (await (await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "123", role }) })).json());
  const admin = await login("admin@aivle.com", "ADMIN");
  const manager = await login("supervisor@aivle.com", "MANAGER");
  const adminHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` };
  const managerHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };

  const denied = await fetch(`${baseUrl}/api/admin/invitations/overview`, { headers: managerHeaders });
  assert.equal(denied.status, 403);
  const examResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: "org-aivle-cs", title: "초대 운영 시험", duration: "90분", questions: "4문제", date: "2099.10.01 10:00" }) });
  const exam = await examResponse.json();
  assert.equal(examResponse.status, 201);
  const assignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: ["candidate-1"] }) });
  assert.equal(assignment.status, 201);
  const sent = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/invitations/send`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: ["candidate-1"] }) });
  assert.equal(sent.status, 201);

  const inventory = await fetch(`${baseUrl}/api/admin/invitations`, { headers: adminHeaders });
  assert.equal(inventory.status, 200);
  const [invitation] = await inventory.json();
  assert.equal(invitation.status, "ACTIVE");
  assert.equal(invitation.token, undefined);
  assert.equal(invitation.tokenHash, undefined);
  const overview = await fetch(`${baseUrl}/api/admin/invitations/overview`, { headers: adminHeaders });
  assert.equal((await overview.json()).metrics.active, 1);

  const policies = await (await fetch(`${baseUrl}/api/admin/policies`, { headers: adminHeaders })).json();
  assert.equal(policies.invitationExpiryHours, undefined);
  const policyUpdate = await fetch(`${baseUrl}/api/admin/policies`, { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ ...policies, invitationSecurity: { ...policies.invitationSecurity, maxVerificationAttempts: 3, verificationLockoutMinutes: 30 } }) });
  assert.equal(policyUpdate.status, 200);
  assert.equal((await policyUpdate.json()).invitationSecurity.maxVerificationAttempts, 3);

  const missingReason = await fetch(`${baseUrl}/api/admin/invitations/${invitation.id}/revoke`, { method: "POST", headers: adminHeaders, body: JSON.stringify({}) });
  assert.equal(missingReason.status, 400);
  const revoked = await fetch(`${baseUrl}/api/admin/invitations/${invitation.id}/revoke`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ reason: "링크 유출 의심" }) });
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).status, "REVOKED");
  const audit = await fetch(`${baseUrl}/api/admin/invitation-audit-logs`, { headers: adminHeaders });
  const actions = (await audit.json()).map((item) => item.action);
  assert.ok(actions.includes("POLICY_UPDATED"));
  assert.ok(actions.includes("INVITATION_REVOKED"));
});

test("allows only ADMIN to manage AI provider settings and organization limits", async (context) => {
  const { baseUrl, directory, server } = await startServer();
  context.after(() => server.close());
  const login = async (email, role) => (await (await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "123", role }) })).json());
  const admin = await login("admin@aivle.com", "ADMIN");
  const manager = await login("supervisor@aivle.com", "MANAGER");
  const managerHeaders = { Authorization: `Bearer ${manager.token}` };
  assert.equal((await fetch(`${baseUrl}/api/admin/ai-settings`, { headers: managerHeaders })).status, 403);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` };
  const initialResponse = await fetch(`${baseUrl}/api/admin/ai-settings`, { headers });
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json();
  assert.equal(typeof initial.apiKeyConfigured, "boolean");
  assert.equal(Object.hasOwn(initial, "apiKey"), false);
  assert.equal(initial.organizations.length, 2);

  const invalid = await fetch(`${baseUrl}/api/admin/ai-settings`, { method: "PATCH", headers, body: JSON.stringify({ ...initial, provider: "", organizations: initial.organizations }) });
  assert.equal(invalid.status, 400);
  const invalidLimit = await fetch(`${baseUrl}/api/admin/ai-settings`, { method: "PATCH", headers, body: JSON.stringify({ provider: "OpenAI", model: "gpt-4o-mini", organizations: initial.organizations.map((organization) => ({ ...organization, monthlyLimit: -1 })) }) });
  assert.equal(invalidLimit.status, 400);

  const organization = initial.organizations[0];
  const update = await fetch(`${baseUrl}/api/admin/ai-settings`, { method: "PATCH", headers, body: JSON.stringify({ provider: "OpenAI", model: "gpt-4.1-mini", organizations: initial.organizations.map((item) => ({ organizationId: item.organizationId, enabled: item.organizationId === organization.organizationId, monthlyLimit: item.organizationId === organization.organizationId ? 120 : 0 })) }) });
  assert.equal(update.status, 200);
  const saved = await update.json();
  assert.equal(saved.model, "gpt-4.1-mini");
  assert.deepEqual(saved.organizations.find((item) => item.organizationId === organization.organizationId), { ...organization, enabled: true, monthlyLimit: 120 });

  const database = JSON.parse(await readFile(join(directory, "database.json"), "utf8"));
  assert.equal(database.systemPolicies.aiModel, "gpt-4.1-mini");
  assert.equal(database.organizationAiPolicies[organization.organizationId].monthlyLimit, 120);
  assert.equal(JSON.stringify(database).includes("AI_API_KEY"), false);
});

test("reuses organization AI policy for quota consumption and monthly reset", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aivle-ai-quota-"));
  const store = await createStore(join(directory, "database.json"));
  await store.updateOrganizationAiPolicies({
    "org-aivle-cs": { enabled: true, monthlyLimit: 1, monthlyUsage: 0, usageMonth: "2026-07" },
    "org-data-lab": { enabled: false, monthlyLimit: 10, monthlyUsage: 0, usageMonth: "2026-07" }
  });
  assert.equal((await store.consumeOrganizationAiQuota("org-data-lab", "2026-07")).reason, "ORGANIZATION_AI_DISABLED");
  assert.equal((await store.consumeOrganizationAiQuota("org-aivle-cs", "2026-07")).allowed, true);
  assert.equal((await store.consumeOrganizationAiQuota("org-aivle-cs", "2026-07")).reason, "MONTHLY_AI_LIMIT_EXCEEDED");
  const nextMonth = await store.consumeOrganizationAiQuota("org-aivle-cs", "2026-08");
  assert.equal(nextMonth.allowed, true);
  assert.equal(nextMonth.policy.monthlyUsage, 1);
  assert.equal(nextMonth.policy.usageMonth, "2026-08");
});

test("encrypts an API key registered by an ADMIN without returning it", async (context) => {
  const { baseUrl, directory, server } = await startServer({ aiSettingsEncryptionKey: "test-encryption-key" });
  context.after(() => server.close());
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@aivle.com", password: "123", role: "ADMIN" }) });
  const admin = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` };
  const initial = await (await fetch(`${baseUrl}/api/admin/ai-settings`, { headers })).json();
  const response = await fetch(`${baseUrl}/api/admin/ai-settings`, { method: "PATCH", headers, body: JSON.stringify({ provider: initial.provider, model: initial.model, apiKey: "secret-ai-key", organizations: initial.organizations }) });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.apiKeyConfigured, true);
  assert.equal(Object.hasOwn(payload, "apiKey"), false);
  const database = await readFile(join(directory, "database.json"), "utf8");
  assert.equal(database.includes("secret-ai-key"), false);
  assert.equal(database.includes("aiEncryptedApiKey"), true);
});

test("uses an organization request and central admin acceptance workflow for AI grading", async (context) => {
  const { baseUrl, server } = await startServer();
  context.after(() => server.close());
  const login = async (email, role) => (await (await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "123", role }) })).json());
  const manager = await login("supervisor@aivle.com", "MANAGER");
  const admin = await login("admin@aivle.com", "ADMIN");
  const managerHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };
  const adminHeaders = { Authorization: `Bearer ${admin.token}` };

  const request = await fetch(`${baseUrl}/api/manager/ai-grading-requests`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ examId: "exam-2026-second-half", candidateId: "candidate-1" }) });
  assert.equal(request.status, 201);
  const pending = await request.json();
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.candidateId, "candidate-1");
  const managerQueue = await fetch(`${baseUrl}/api/manager/ai-grading-requests?organizationId=org-aivle-cs&examId=exam-2026-second-half`, { headers: managerHeaders });
  assert.equal(managerQueue.status, 200);
  assert.equal((await managerQueue.json())[0].id, pending.id);
  const outOfScopeManagerQueue = await fetch(`${baseUrl}/api/manager/ai-grading-requests?organizationId=org-data-lab`, { headers: managerHeaders });
  assert.equal(outOfScopeManagerQueue.status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/ai-grading-requests`, { headers: { Authorization: `Bearer ${manager.token}` } })).status, 403);

  const queue = await fetch(`${baseUrl}/api/admin/ai-grading-requests`, { headers: adminHeaders });
  assert.equal(queue.status, 200);
  assert.equal((await queue.json())[0].id, pending.id);
  const acceptance = await fetch(`${baseUrl}/api/admin/ai-grading-requests/${pending.id}/accept`, { method: "POST", headers: adminHeaders });
  assert.equal(acceptance.status, 202);
  assert.equal((await acceptance.json()).status, "PROCESSING");
});
