import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_INVITE_LEAD_MINUTES,
  ExamOperationsAgentError,
  assertCanStartExamOperations,
  computeInvitationScheduledAt,
  isInvitationLocked,
  normalizeInviteLeadMinutes,
  phaseForInviteSchedule,
  previewExamOperationsCandidates
} from "../src/examOperationsAgent.mjs";

test("normalizes invitation lead minutes with default and bounds", () => {
  assert.equal(DEFAULT_INVITE_LEAD_MINUTES, 60);
  assert.equal(normalizeInviteLeadMinutes(undefined), 60);
  assert.equal(normalizeInviteLeadMinutes(0), 0);
  assert.equal(normalizeInviteLeadMinutes("10080"), 10080);
  assert.throws(() => normalizeInviteLeadMinutes(-1), /0분부터 7일/);
  assert.throws(() => normalizeInviteLeadMinutes(10081), /0분부터 7일/);
  assert.throws(() => normalizeInviteLeadMinutes(1.5), /0분부터 7일/);
});

test("computes invitation schedule and clamps late starts to now", () => {
  const startsAt = "2099-01-01T01:00:00.000Z";
  assert.equal(
    computeInvitationScheduledAt({ startsAt, leadMinutes: 60, now: Date.parse("2098-12-31T23:00:00.000Z") }),
    "2099-01-01T00:00:00.000Z"
  );
  assert.equal(
    computeInvitationScheduledAt({ startsAt, leadMinutes: 60, now: Date.parse("2099-01-01T00:30:00.000Z") }),
    "2099-01-01T00:30:00.000Z"
  );
  assert.equal(phaseForInviteSchedule({ scheduledAt: "2099-01-01T00:30:00.000Z", now: Date.parse("2099-01-01T00:29:00.000Z") }), "WAITING_INVITATION");
  assert.equal(phaseForInviteSchedule({ scheduledAt: "2099-01-01T00:30:00.000Z", now: Date.parse("2099-01-01T00:30:00.000Z") }), "INVITING");
});

test("previews eligible organization candidates and redacted exclusion reasons", () => {
  const exam = { id: "exam", organizationId: "org-a" };
  const candidates = [
    { id: "other-org", name: "Other", email: "ok@example.com", birthDate: "2000-01-01", organizationId: "org-b", status: "REGISTERED" },
    { id: "eligible", name: "Eligible", email: "ok@example.com", birthDate: "2000-01-01", organizationId: "org-a", status: "REGISTERED" },
    { id: "test", name: "Test", email: "test@example.com", birthDate: "2000-01-01", organizationId: "org-a", status: "REGISTERED", isTestCandidate: true },
    { id: "bad-mail", name: "Bad Email", email: "bad", birthDate: "2000-01-01", organizationId: "org-a", status: "REGISTERED" },
    { id: "missing-birth", name: "Missing Birth", email: "birth@example.com", birthDate: "", organizationId: "org-a", status: "REGISTERED" },
    { id: "paused", name: "Paused", email: "paused@example.com", birthDate: "2000-01-01", organizationId: "org-a", status: "SUSPENDED" },
    { id: "duplicate", name: "Duplicate", email: "ok@example.com", birthDate: "2000-01-01", organizationId: "org-a", status: "REGISTERED" },
  ];
  const preview = previewExamOperationsCandidates({ exam, candidates, now: Date.parse("2099-01-01T00:00:00.000Z") });
  assert.deepEqual(preview.eligibleCandidates.map((candidate) => candidate.id), ["eligible"]);
  assert.equal(preview.totalCandidateCount, 6);
  assert.equal(preview.excludedCandidateCount, 5);
  assert.deepEqual(Object.fromEntries(preview.excludedCandidates.map((item) => [item.candidateId, item.reasons])), {
    test: ["TEST_CANDIDATE"],
    "bad-mail": ["INVALID_EMAIL"],
    "missing-birth": ["MISSING_BIRTH_DATE"],
    paused: ["STATUS_NOT_REGISTERED"],
    duplicate: ["DUPLICATE_EMAIL"],
  });
  assert.equal(preview.excludedCandidates.some((item) => item.candidateId === "other-org"), false);
  assert.equal(JSON.stringify(preview.excludedCandidates).includes("@example.com"), false);
});

test("start validation denies wrong scope, empty exams, ended exams, and zero eligible candidates", () => {
  const base = {
    exam: { id: "exam", organizationId: "org-a" },
    manager: { id: "manager" },
    managedOrganizationIds: ["org-a"],
    questionCount: 1,
    candidatePreview: { eligibleCandidateCount: 1 },
    startsAt: "2099-01-01T00:00:00.000Z",
    endsAt: "2099-01-01T01:00:00.000Z",
    now: Date.parse("2098-12-31T00:00:00.000Z")
  };
  assert.doesNotThrow(() => assertCanStartExamOperations(base));
  assert.throws(() => assertCanStartExamOperations({ ...base, managedOrganizationIds: ["org-b"] }), ExamOperationsAgentError);
  assert.throws(() => assertCanStartExamOperations({ ...base, questionCount: 0 }), /저장된 문제/);
  assert.throws(() => assertCanStartExamOperations({ ...base, candidatePreview: { eligibleCandidateCount: 0 } }), /유효 응시자/);
  assert.throws(() => assertCanStartExamOperations({ ...base, now: Date.parse("2099-01-01T02:00:00.000Z") }), /종료된 시험/);
});

test("invitation lock treats SENT and PREVIEW as lead-edit blockers", () => {
  assert.equal(isInvitationLocked([{ examId: "exam", deliveryStatus: "FAILED" }], "exam"), false);
  assert.equal(isInvitationLocked([{ examId: "exam", deliveryStatus: "PREVIEW" }], "exam"), true);
  assert.equal(isInvitationLocked([{ examId: "exam", deliveryStatus: "SENT", revokedAt: "2099-01-01T00:00:00.000Z" }], "exam"), false);
});
