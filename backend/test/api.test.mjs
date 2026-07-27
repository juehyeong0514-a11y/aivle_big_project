import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.mjs";
import { createStore } from "../src/store.mjs";

const startServer = async () => {
  const directory = await mkdtemp(join(tmpdir(), "aivle-api-"));
  const app = await createApp({ databasePath: join(directory, "database.json") });
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

test("governs organization approval, manager scope, and one-time invitations", async (context) => {
  const { baseUrl, directory, server } = await startServer();
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
  const afterApprovalExam = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "승인 후 평가", duration: "60분", questions: "총 1문제" }) });
  assert.equal(afterApprovalExam.status, 201);
  const organizations = await fetch(`${baseUrl}/api/admin/organizations`, { headers: { Authorization: `Bearer ${admin.token}` } });
  const managedOrganization = (await organizations.json()).find((candidate) => candidate.id === organization.id);
  assert.equal(managedOrganization.managers.length, 1);
  const outOfScopeCandidate = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: "org-aivle-cs", name: "범위 밖 응시자", email: "outside@example.com" }) });
  assert.equal(outOfScopeCandidate.status, 403);
  const candidateResponse = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, name: "초대 응시자", email: "invitee@example.com" }) });
  const candidate = await candidateResponse.json();
  assert.match(candidate.candidateNumber, /^AIVLE-/);
  const examResponse = await fetch(`${baseUrl}/api/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, title: "C 조직 평가", duration: "60분", questions: "총 5문제", date: "2026.08.01 10:00" }) });
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
  const removableCandidateResponse = await fetch(`${baseUrl}/api/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: organization.id, name: "Remove Before Invite", email: "remove-before-invite@example.com" }) });
  const removableCandidate = await removableCandidateResponse.json();
  const removableAssignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [removableCandidate.id] }) });
  assert.equal(removableAssignment.status, 201);
  const removeAssignment = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/assignments`, { method: "DELETE", headers: managerHeaders, body: JSON.stringify({ candidateIds: [removableCandidate.id] }) });
  assert.equal(removeAssignment.status, 200);
  assert.equal((await removeAssignment.json()).removedCount, 1);
  const invitationResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/invitations/send`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  const invitation = await invitationResponse.json();
  assert.equal(invitation.count, 1);
  assert.equal(invitation.deliveryStatus, "PREVIEW");
  assert.equal(invitation.mailPreviews[0].oneTimeToken, undefined);
  const entryUrl = new URL(invitation.mailPreviews[0].entryLink);
  assert.equal(entryUrl.pathname, "/exam/enter");
  const token = entryUrl.searchParams.get("token");
  assert.ok(token);
  const invitationInfo = await fetch(`${baseUrl}/api/invitations/${token}`);
  assert.equal(invitationInfo.status, 200);
  assert.equal((await invitationInfo.json()).duration, "60분");
  const savedDatabase = JSON.parse(await readFile(join(directory, "database.json"), "utf8"));
  assert.equal(savedDatabase.invitations[0].token, undefined);
  assert.ok(savedDatabase.invitations[0].tokenHash);
  const verified = await fetch(`${baseUrl}/api/invitations/${token}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: candidate.candidateNumber }) });
  assert.equal(verified.status, 200);
  const applicantToken = (await verified.json()).accessToken;
  const applicantSession = await fetch(`${baseUrl}/api/applicant/session`, { headers: { Authorization: `Bearer ${applicantToken}` } });
  assert.equal(applicantSession.status, 200);
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
  assert.equal((await examinees.json()).length, 2);
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
