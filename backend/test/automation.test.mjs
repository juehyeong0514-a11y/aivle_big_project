import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp, isExamStartBypassEnabled, scheduledExamEndsAt, scheduledExamStartsAt, shouldWaitForExamStart } from "../src/app.mjs";

const fixture = async (options = {}) => {
  const directory = await mkdtemp(join(tmpdir(), "aivle-automation-"));
  const app = await createApp({ databasePath: join(directory, "database.json"), startAutomation: false, ...options });
  return { app, store: app.locals.store };
};

test("parses the scheduled exam start in Asia/Seoul time", () => {
  assert.equal(scheduledExamStartsAt({ date: "2099.01.01 10:30" }), "2099-01-01T01:30:00.000Z");
  assert.equal(scheduledExamStartsAt({ date: "invalid" }), undefined);
});

test("waits before the exam for regular candidates but lets test candidates enter", () => {
  const exam = { date: "2099.01.01 10:30" };
  const beforeStart = Date.parse("2099-01-01T01:00:00.000Z");
  assert.equal(shouldWaitForExamStart({ isTestCandidate: false }, exam, beforeStart), true);
  assert.equal(shouldWaitForExamStart({ isTestCandidate: true }, exam, beforeStart), false);
  assert.equal(shouldWaitForExamStart({ isTestCandidate: false }, exam, beforeStart, true), false);
  assert.equal(shouldWaitForExamStart({}, exam, Date.parse("2099-01-01T01:30:00.000Z")), false);
});

test("exam start bypass is opt-in in every server environment", () => {
  assert.equal(isExamStartBypassEnabled({}), false);
  assert.equal(isExamStartBypassEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isExamStartBypassEnabled({ EXAM_START_BYPASS_ENABLED: "true" }), true);
  assert.equal(isExamStartBypassEnabled({ NODE_ENV: "development", EXAM_START_BYPASS_ENABLED: "true" }), true);
  assert.equal(isExamStartBypassEnabled({ NODE_ENV: "production", EXAM_START_BYPASS_ENABLED: "true" }), true);
});

test("exam start bypass unlocks the waiting exam for only the authenticated applicant session", async (context) => {
  const { app } = await fixture({ examStartBypassEnabled: true });
  const server = app.listen(0);
  await new Promise((resolveReady) => server.once("listening", resolveReady));
  context.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(`${baseUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" }) });
  const manager = await login.json();
  const managerHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${manager.token}` };
  const candidateResponse = await fetch(`${baseUrl}/manager/candidates`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: "org-aivle-cs", name: "Bypass Test", email: "bypass-test@example.com", birthDate: "2000-01-01" }) });
  const candidate = await candidateResponse.json();
  const examResponse = await fetch(`${baseUrl}/manager/exams`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ organizationId: "org-aivle-cs", title: "Bypass Test Exam", duration: "60분", questions: "총 1문제", date: "2099.01.01 10:00" }) });
  const exam = await examResponse.json();
  await fetch(`${baseUrl}/manager/exams/${exam.id}/assign`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  const invitationResponse = await fetch(`${baseUrl}/manager/exams/${exam.id}/invitations/send`, { method: "POST", headers: managerHeaders, body: JSON.stringify({ candidateIds: [candidate.id] }) });
  const invitation = await invitationResponse.json();
  const invitationToken = new URL(invitation.mailPreviews[0].entryLink).searchParams.get("token");
  const verification = await fetch(`${baseUrl}/invitations/${invitationToken}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: candidate.candidateNumber }) });
  const applicant = await verification.json();
  const applicantHeaders = { Authorization: `Bearer ${applicant.accessToken}` };
  assert.equal((await (await fetch(`${baseUrl}/applicant/exam`, { headers: applicantHeaders })).json()).waiting, true);
  assert.equal((await fetch(`${baseUrl}/applicant/exam/test-start-bypass`, { method: "POST", headers: applicantHeaders })).status, 200);
  assert.equal((await (await fetch(`${baseUrl}/applicant/exam`, { headers: applicantHeaders })).json()).waiting, false);
  const secondVerification = await fetch(`${baseUrl}/invitations/${invitationToken}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateNumber: candidate.candidateNumber }) });
  const secondApplicant = await secondVerification.json();
  assert.equal((await (await fetch(`${baseUrl}/applicant/exam`, { headers: { Authorization: `Bearer ${secondApplicant.accessToken}` } })).json()).waiting, true);
});

test("automatic processing is a cutoff no-op before scheduledExamEndsAt and catches up after restart", async () => {
  let now = Date.parse("2099-01-01T00:00:00.000Z");
  const { app, store } = await fixture({ automationClock: () => now });
  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  await store.updateExam(exam.id, { date: "2099.01.01 11:00", duration: "30분" });
  assert.equal(scheduledExamEndsAt(store.exams.find((item) => item.id === exam.id)), "2099-01-01T02:30:00.000Z");
  await app.locals.automation.runNow();
  assert.equal(store.examAutomationStates.find((item) => item.examId === exam.id).status, "PENDING");
  now = Date.parse("2099-01-01T03:00:00.000Z");
  await app.locals.automation.runNow();
  assert.equal(store.examAutomationStates.find((item) => item.examId === exam.id).status, "COMPLETED");
  app.locals.automation.stop();
});

test("cutoff finalization marks never-started invitations ABSENT and grades started coding submissions once", async () => {
  const calls = [];
  const sent = [];
  const previousApiKey = process.env.AI_API_KEY;
  process.env.AI_API_KEY = "test-automation-key";
  const { app, store } = await fixture({
    automationClock: () => Date.parse("2099-01-02T03:00:00.000Z"),
    aiProviderInvoker: async () => {
      calls.push(Date.now());
      return { score: 24, maxScore: 30, feedback: "ok", rubricBreakdown: [] };
    },
    emailSender: async (payload) => {
      sent.push(payload.to);
      return true;
    }
  });
  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  await store.updateExam(exam.id, { date: "2099.01.02 01:00", duration: "30분" });
  const absentCandidate = { id: "candidate-absent", name: "Absent", email: "absent@example.com", organizationId: exam.organizationId, candidateNumber: "ABSENT-1" };
  await store.addCandidate(absentCandidate);
  await store.addAssignment({ id: "assignment-absent", examId: exam.id, candidateId: absentCandidate.id, status: "INVITED" });
  await store.addInvitation({ id: "invitation-absent", examId: exam.id, candidateId: absentCandidate.id, organizationId: exam.organizationId, candidateNumber: absentCandidate.candidateNumber, expiresAt: "2099-01-02T02:00:00.000Z" });
  const startedCandidate = store.candidates.find((item) => item.id === "candidate-1");
  await store.addInvitation({ id: "invitation-started", examId: exam.id, candidateId: startedCandidate.id, organizationId: exam.organizationId, candidateNumber: startedCandidate.candidateNumber, verifiedAt: "2099-01-02T01:30:00.000Z", expiresAt: "2099-01-02T02:00:00.000Z" });
  await store.saveCodingSubmission({ id: "submission-started", examId: exam.id, organizationId: exam.organizationId, candidateId: startedCandidate.id, answers: { "coding-example-1": { language: "JavaScript", source: "console.log(5)" } }, runResults: {}, status: "DRAFT", submittedAt: null, updatedAt: "2099-01-02T01:40:00.000Z" });
  await app.locals.automation.runNow();
  assert.equal(store.assignments.find((item) => item.id === "assignment-absent").resultStatus, "ABSENT");
  assert.equal(store.candidateAutomationStates.find((item) => item.candidateId === absentCandidate.id).status, "ABSENT");
  assert.equal(store.assignments.find((item) => item.candidateId === startedCandidate.id && item.examId === exam.id).status, "SUBMITTED");
  assert.equal(calls.length, 1);
  assert.equal(sent.length, 1);
  await app.locals.automation.runNow();
  assert.equal(calls.length, 1);
  assert.equal(sent.length, 1);
  if (previousApiKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = previousApiKey;
  app.locals.automation.stop();
});

test("organization mismatches are excluded before AI grading or result email", async () => {
  const calls = [];
  const { app, store } = await fixture({
    automationClock: () => Date.parse("2099-01-03T03:00:00.000Z"),
    aiProviderInvoker: async () => { calls.push("ai"); return { score: 1 }; },
    emailSender: async () => { calls.push("email"); return true; }
  });
  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  await store.updateExam(exam.id, { date: "2099.01.03 01:00", duration: "30분" });
  const candidate = store.candidates.find((item) => item.id === "candidate-1");
  await store.addInvitation({ id: "invitation-mismatch", examId: exam.id, candidateId: candidate.id, organizationId: "org-data-lab", candidateNumber: candidate.candidateNumber, verifiedAt: "2099-01-03T01:30:00.000Z", expiresAt: "2099-01-03T02:00:00.000Z" });
  await store.addAssignment({ id: "assignment-mismatch", examId: exam.id, candidateId: candidate.id, organizationId: "org-data-lab", status: "INVITED" });
  await store.saveCodingSubmission({ id: "submission-mismatch", examId: exam.id, organizationId: exam.organizationId, candidateId: candidate.id, answers: { "coding-example-1": { language: "JavaScript", source: "console.log(1)" } }, runResults: {}, status: "DRAFT", submittedAt: null, updatedAt: "2099-01-03T01:40:00.000Z" });
  await app.locals.automation.runNow();
  assert.deepEqual(calls, []);
  assert.equal(store.candidateAutomationStates.find((item) => item.candidateId === candidate.id && item.examId === exam.id).reason, "ORGANIZATION_MISMATCH");
  app.locals.automation.stop();
});

test("automatic grading failure honors persisted backoff and terminal retry cap", async () => {
  const calls = [];
  const previousApiKey = process.env.AI_API_KEY;
  process.env.AI_API_KEY = "test-automation-key";
  let now = Date.parse("2099-01-05T03:00:00.000Z");
  const { app, store } = await fixture({
    automationClock: () => now,
    aiProviderInvoker: async () => { calls.push(now); throw new Error("provider-token-DO-NOT-EXPOSE"); }
  });
  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  await store.updateExam(exam.id, { date: "2099.01.05 01:00", duration: "30분" });
  const candidate = store.candidates.find((item) => item.id === "candidate-1");
  await store.addInvitation({ id: "retry-cap-invitation", examId: exam.id, candidateId: candidate.id, organizationId: exam.organizationId, candidateNumber: candidate.candidateNumber, verifiedAt: "2099-01-05T01:30:00.000Z", expiresAt: "2099-01-05T02:00:00.000Z" });
  await store.saveCodingSubmission({ id: "retry-cap-submission", examId: exam.id, organizationId: exam.organizationId, candidateId: candidate.id, answers: { "coding-example-1": { language: "JavaScript", source: "console.log(1)" } }, runResults: {}, status: "DRAFT", submittedAt: null, updatedAt: "2099-01-05T01:40:00.000Z" });
  await app.locals.automation.runNow();
  now += 60_001;
  await app.locals.automation.runNow();
  now += 5 * 60_001;
  await app.locals.automation.runNow();
  const request = store.aiGradingRequests.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
  assert.equal(request.retryCount, 3);
  assert.equal(store.candidateAutomationStates.find((item) => item.examId === exam.id && item.candidateId === candidate.id).status, "GRADING_FAILED");
  now += 15 * 60_001;
  await app.locals.automation.runNow();
  assert.equal(calls.length, 3);
  if (previousApiKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = previousApiKey;
  app.locals.automation.stop();
});

test("manual recovery clears an active lease and rejects candidates outside the exam", async (context) => {
  const { app, store } = await fixture({ automationClock: () => Date.parse("2099-01-04T03:00:00.000Z") });
  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  await store.updateExam(exam.id, { date: "2099.01.04 01:00", duration: "30분" });
  const server = app.listen(0);
  context.after(() => { app.locals.automation.stop(); server.close(); });
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@aivle.com", password: "123", role: "ADMIN" }) });
  const { token } = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const queue = await fetch(`${baseUrl}/api/admin/ai-grading-requests`, { headers });
  const queuePayload = await queue.json();
  assert.equal(queue.status, 200);
  assert.ok(Array.isArray(queuePayload));
  const summaryResponse = await fetch(`${baseUrl}/api/admin/ai-invocation-logs/automation-summary`, { headers });
  const summary = await summaryResponse.json();
  for (const field of ["absent", "excluded", "processing", "failed", "emailSent", "emailFailed", "progress"]) assert.equal(typeof summary[field], "number");
  assert.ok(Array.isArray(summary.candidates));
  const invalid = await fetch(`${baseUrl}/api/admin/exams/${exam.id}/automation/retry`, { method: "POST", headers, body: JSON.stringify({ candidateId: "not-in-this-exam" }) });
  assert.equal(invalid.status, 404);
  assert.equal(store.examAutomationStates.some((item) => item.examId === exam.id), false);
  const missingBody = await fetch(`${baseUrl}/api/admin/exams/${exam.id}/automation/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(missingBody.status, 400);
  await store.upsertExamAutomationState(exam.id, { status: "PROCESSING", processingLeaseUntil: "2099-01-04T04:00:00.000Z", processingLeaseId: "lease" });
  const candidate = store.candidates.find((item) => item.id === "candidate-1");
  await store.addInvitation({ id: "manual-recovery-invitation", examId: exam.id, candidateId: candidate.id, organizationId: exam.organizationId, candidateNumber: candidate.candidateNumber, verifiedAt: "2099-01-04T01:30:00.000Z", expiresAt: "2099-01-04T02:00:00.000Z" });
  await store.upsertResultEmailDelivery(exam.id, candidate.id, { status: "FAILED", retryCount: 4, attempts: 4, lastError: "terminal" });
  await store.upsertCandidateAutomationState(exam.id, candidate.id, { status: "EMAIL_FAILED", reason: "smtp-token-SECRET-123", lastError: "smtp-token-SECRET-123" });
  await store.addAiGradingRequest({ id: "redaction-request", examId: exam.id, candidateId: candidate.id, organizationId: exam.organizationId, status: "FAILED", autoTriggered: true, errorMessage: "provider-key-SECRET-456", requestedAt: "2099-01-04T02:00:00.000Z" });
  const queueRedaction = await fetch(`${baseUrl}/api/admin/ai-grading-requests`, { headers });
  assert.equal((await queueRedaction.text()).includes("provider-key-SECRET-456"), false);
  const statusResponse = await fetch(`${baseUrl}/api/admin/exams/${exam.id}/automation-status`, { headers });
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.text()).includes("smtp-token-SECRET-123"), false);
  const retry = await fetch(`${baseUrl}/api/admin/exams/${exam.id}/automation/retry`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(retry.status, 200);
  assert.equal(store.examAutomationStates.find((item) => item.examId === exam.id).processingLeaseUntil, null);
  assert.equal(store.resultEmailDeliveries.find((item) => item.examId === exam.id && item.candidateId === candidate.id).retryCount, 0);
});

test("manager operations agent start enforces scope, prerequisites, due-now invitations, and idempotency", async (context) => {
  let now = Date.parse("2099-02-01T00:30:00.000Z");
  const { app, store } = await fixture({ automationClock: () => now });
  const server = app.listen(0);
  context.after(() => { app.locals.automation.stop(); server.close(); });
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" }) });
  const { token } = await login.json();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  await store.addExam({ id: "agent-other-org", title: "Other org", duration: "30분", date: "2099.02.01 10:00", status: "AVAILABLE", organizationId: "org-data-lab", inviteLeadMinutes: 60 });
  const forbidden = await fetch(`${baseUrl}/api/manager/exams/agent-other-org/automation/start`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(forbidden.status, 403);

  await store.addExam({ id: "agent-no-question", title: "No question", duration: "30분", date: "2099.02.01 10:00", status: "AVAILABLE", organizationId: "org-aivle-cs", inviteLeadMinutes: 60 });
  const noQuestion = await fetch(`${baseUrl}/api/manager/exams/agent-no-question/automation/start`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(noQuestion.status, 409);
  assert.equal((await noQuestion.json()).code, "NO_QUESTIONS");

  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  await store.updateExam(exam.id, { date: "2099.02.01 10:00", duration: "60분", inviteLeadMinutes: 60 });
  await store.addCandidate({ id: "agent-test-candidate", name: "Test", email: "agent-test@example.com", birthDate: "2000-01-01", organizationId: exam.organizationId, candidateNumber: "AGENT-TEST", status: "REGISTERED", isTestCandidate: true });
  await store.addCandidate({ id: "agent-bad-email", name: "Bad", email: "bad", birthDate: "2000-01-01", organizationId: exam.organizationId, candidateNumber: "AGENT-BAD", status: "REGISTERED" });

  const previewResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation-status`, { headers });
  const preview = await previewResponse.json();
  assert.equal(preview.state.inviteLeadMinutes, 60);
  assert.equal(preview.preview.eligibleCandidateCount, 1);
  assert.equal(preview.preview.excludedCandidates.some((item) => item.candidateId === "agent-test-candidate" && item.reasons.includes("TEST_CANDIDATE")), true);

  const [start, concurrentStart] = await Promise.all([
    fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation/start`, { method: "POST", headers, body: JSON.stringify({}) }),
    fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation/start`, { method: "POST", headers, body: JSON.stringify({}) })
  ]);
  assert.equal(start.status, 202);
  assert.equal(concurrentStart.status, 202);
  const started = await start.json();
  const concurrentlyStarted = await concurrentStart.json();
  assert.equal(started.state.phase, "WAITING_EXAM");
  assert.equal(concurrentlyStarted.state.phase, "WAITING_EXAM");
  assert.equal(started.state.invitationDeliveryStatus, "PREVIEW");
  assert.equal(store.invitations.filter((item) => item.examId === exam.id && !item.revokedAt).length, 1);
  assert.equal(store.assignments.some((item) => item.examId === exam.id && item.candidateId === "agent-test-candidate"), false);

  const pausedResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation/pause`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(pausedResponse.status, 200);
  assert.equal((await pausedResponse.json()).state.paused, true);
  await app.locals.automation.runNow();
  assert.equal(store.examAutomationStates.find((item) => item.examId === exam.id).paused, true);
  const resumedResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation/resume`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(resumedResponse.status, 200);
  assert.equal((await resumedResponse.json()).state.paused, false);

  const cancelledResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation/cancel`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(cancelledResponse.status, 200);
  const cancelled = await cancelledResponse.json();
  assert.equal(cancelled.state.managedByAgent, false);
  assert.equal(cancelled.state.phase, "CANCELLED");
  const restartedResponse = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation/start`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(restartedResponse.status, 202);

  await app.locals.automation.runNow();
  await app.locals.automation.runNow();
  assert.equal(store.invitations.filter((item) => item.examId === exam.id && !item.revokedAt).length, 1);
  const repeatedStart = await fetch(`${baseUrl}/api/manager/exams/${exam.id}/automation/start`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(repeatedStart.status, 202);
  assert.equal(store.invitations.filter((item) => item.examId === exam.id && !item.revokedAt).length, 1);

  const endedSchedule = await fetch(`${baseUrl}/api/manager/exams/${exam.id}`, { method: "PATCH", headers, body: JSON.stringify({ date: "2099.02.01 08:00", duration: "30분" }) });
  assert.equal(endedSchedule.status, 200);
  assert.notEqual(store.examAutomationStates.find((item) => item.examId === exam.id).phase, "WAITING_EXAM");

  const lockedLead = await fetch(`${baseUrl}/api/manager/exams/${exam.id}`, { method: "PATCH", headers, body: JSON.stringify({ inviteLeadMinutes: 30 }) });
  assert.equal(lockedLead.status, 409);

  await store.updateCandidate("candidate-1", { status: "SUSPENDED" });
  await store.addExam({ id: "agent-no-eligible", title: "No eligible", duration: "30분", date: "2099.02.01 10:00", status: "AVAILABLE", organizationId: "org-aivle-cs", inviteLeadMinutes: 60 });
  await store.addQuestion({ id: "agent-no-eligible-question", examId: "agent-no-eligible", type: "MULTIPLE_CHOICE", prompt: "1?", options: ["1", "2"], answer: "1" });
  const noEligible = await fetch(`${baseUrl}/api/manager/exams/agent-no-eligible/automation/start`, { method: "POST", headers, body: JSON.stringify({}) });
  assert.equal(noEligible.status, 409);
  assert.equal((await noEligible.json()).code, "NO_ELIGIBLE_CANDIDATES");
  now += 1;
});

test("operations result email holds proctor warnings and releases once review is NORMAL", async () => {
  const sent = [];
  const previousApiKey = process.env.AI_API_KEY;
  process.env.AI_API_KEY = "test-automation-key";
  let now = Date.parse("2099-02-02T03:00:00.000Z");
  const { app, store } = await fixture({
    automationClock: () => now,
    aiProviderInvoker: async () => ({ score: 27, maxScore: 30, feedback: "ok", rubricBreakdown: [] }),
    emailSender: async (payload) => {
      sent.push(payload.to);
      return true;
    }
  });
  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  await store.updateExam(exam.id, { date: "2099.02.02 10:00", duration: "30분", inviteLeadMinutes: 60 });
  const candidate = store.candidates.find((item) => item.id === "candidate-1");
  await store.addInvitation({ id: "hold-release-invitation", examId: exam.id, candidateId: candidate.id, organizationId: exam.organizationId, candidateNumber: candidate.candidateNumber, verifiedAt: "2099-02-02T01:30:00.000Z", expiresAt: "2099-02-02T02:00:00.000Z" });
  await store.saveCodingSubmission({ id: "hold-release-submission", examId: exam.id, organizationId: exam.organizationId, candidateId: candidate.id, answers: { "coding-example-1": { language: "JavaScript", source: "console.log(1)" } }, runResults: {}, status: "DRAFT", submittedAt: null, updatedAt: "2099-02-02T01:40:00.000Z" });
  await store.addExaminee({ id: "hold-release-examinee", candidateId: candidate.id, name: candidate.name, organizationId: exam.organizationId, examId: exam.id, status: "NORMAL", statusText: "시험 입장 완료", currentProb: "시험 시작 전" });
  await store.addWarning({ id: "hold-warning", examineeId: "hold-release-examinee", examId: exam.id, organizationId: exam.organizationId, message: "경고", source: "SUPERVISOR", createdAt: "2099-02-02T01:45:00.000Z" });

  await app.locals.automation.runNow();
  assert.equal(sent.length, 0);
  assert.equal(store.resultEmailDeliveries.find((item) => item.examId === exam.id && item.candidateId === candidate.id).status, "REVIEW_REQUIRED");
  assert.equal(store.candidateAutomationStates.find((item) => item.examId === exam.id && item.candidateId === candidate.id).status, "REVIEW_REQUIRED");

  const assignment = store.assignments.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
  await store.updateAssignment(assignment.id, { reviewStatus: "NORMAL", reviewedAt: new Date(now).toISOString(), reviewedBy: "test-manager" });
  await store.updateCandidateAutomationState(exam.id, candidate.id, { status: "EMAIL_PENDING", reason: "", lastError: "" });
  await app.locals.automation.runNow();
  assert.deepEqual(sent, [candidate.email]);
  assert.equal(store.resultEmailDeliveries.find((item) => item.examId === exam.id && item.candidateId === candidate.id).status, "SENT");
  await app.locals.automation.runNow();
  assert.equal(sent.length, 1);

  if (previousApiKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = previousApiKey;
  app.locals.automation.stop();
});

test("manager results enrich automation fields without mutating persisted assignments", async (context) => {
  const { app, store } = await fixture();
  const exam = store.exams.find((item) => item.id === "exam-2026-second-half");
  const candidate = store.candidates.find((item) => item.id === "candidate-1");
  const assignment = store.assignments.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
  const before = structuredClone(assignment);
  await store.upsertCandidateAutomationState(exam.id, candidate.id, { status: "FAILED", reason: "provider-token-SECRET-789" });
  await store.addAiGradingRequest({ id: "manager-redaction-request", examId: exam.id, candidateId: candidate.id, organizationId: exam.organizationId, status: "FAILED", errorMessage: "provider-token-SECRET-789", requestedAt: new Date().toISOString() });
  const server = app.listen(0);
  context.after(() => { app.locals.automation.stop(); server.close(); });
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "supervisor@aivle.com", password: "123", role: "MANAGER" }) });
  const { token } = await login.json();
  const managerHeaders = { Authorization: `Bearer ${token}` };
  const queueResponse = await fetch(`${baseUrl}/api/manager/ai-grading-requests?examId=${exam.id}`, { headers: managerHeaders });
  assert.equal(queueResponse.status, 200);
  assert.equal((await queueResponse.text()).includes("provider-token-SECRET-789"), false);
  const response = await fetch(`${baseUrl}/api/manager/results?examId=${exam.id}`, { headers: managerHeaders });
  assert.equal(response.status, 200);
  const rows = await response.json();
  const row = rows.find((item) => item.candidateId === candidate.id);
  assert.equal(row.automationStatus, "FAILED");
  assert.equal(row.automationFailureCode, "AI_GRADING_FAILED");
  assert.equal(row.automationFailureReason.includes("SECRET"), false);
  assert.equal(JSON.stringify(row).includes("provider-token-SECRET-789"), false);
  assert.deepEqual(assignment, before);
});
