export const DEFAULT_INVITE_LEAD_MINUTES = 60;
export const MAX_INVITE_LEAD_MINUTES = 7 * 24 * 60;

export class ExamOperationsAgentError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ExamOperationsAgentError";
    this.code = code;
    this.status = status;
  }
}

export const normalizeInviteLeadMinutes = (value, fallback = DEFAULT_INVITE_LEAD_MINUTES) => {
  const source = value === undefined || value === null || value === "" ? fallback : value;
  const number = Number(source);
  if (!Number.isInteger(number) || number < 0 || number > MAX_INVITE_LEAD_MINUTES) {
    throw new ExamOperationsAgentError("INVALID_INVITE_LEAD_MINUTES", "초대 사전 발송 시간은 0분부터 7일 전까지 정수로 입력해주세요.", 400);
  }
  return number;
};

export const isValidCandidateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());

export const isValidCandidateBirthDate = (value, now = Date.now()) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getTime() <= now;
};

export const computeInvitationScheduledAt = ({ startsAt, leadMinutes = DEFAULT_INVITE_LEAD_MINUTES, now = Date.now() }) => {
  const startMs = typeof startsAt === "string" ? Date.parse(startsAt) : Number(startsAt);
  if (!Number.isFinite(startMs)) {
    throw new ExamOperationsAgentError("INVALID_EXAM_SCHEDULE", "시험 일정과 제한 시간을 확인해주세요.", 400);
  }
  const lead = normalizeInviteLeadMinutes(leadMinutes);
  const scheduledMs = startMs - lead * 60_000;
  return new Date(Math.max(now, scheduledMs)).toISOString();
};

export const phaseForInviteSchedule = ({ scheduledAt, now = Date.now() }) => Date.parse(scheduledAt) <= now ? "INVITING" : "WAITING_INVITATION";

const pushReason = (reasons, code) => {
  if (!reasons.includes(code)) reasons.push(code);
};

export const previewExamOperationsCandidates = ({ exam, candidates = [], now = Date.now() }) => {
  const eligible = [];
  const excluded = [];
  const seenIds = new Set();
  const seenEmails = new Set();
  const sameOrganizationCandidates = candidates.filter((candidate) => {
    if (candidate?.organizationId !== exam?.organizationId) return false;
    const scope = candidate?.scope ?? "ORGANIZATION";
    return scope === "ORGANIZATION" || (scope === "EXAM" && candidate?.examId === exam?.id);
  });

  for (const candidate of sameOrganizationCandidates) {
    const reasons = [];
    const normalizedEmail = String(candidate?.email ?? "").trim().toLowerCase();
    if (!candidate?.id || seenIds.has(candidate.id)) pushReason(reasons, "DUPLICATE_CANDIDATE");
    if (candidate?.id) seenIds.add(candidate.id);
    if (candidate?.organizationId !== exam?.organizationId) pushReason(reasons, "ORGANIZATION_MISMATCH");
    if (candidate?.status !== "REGISTERED") pushReason(reasons, "STATUS_NOT_REGISTERED");
    if (candidate?.isTestCandidate === true) pushReason(reasons, "TEST_CANDIDATE");
    if (!isValidCandidateEmail(normalizedEmail)) pushReason(reasons, "INVALID_EMAIL");
    else if (seenEmails.has(normalizedEmail)) pushReason(reasons, "DUPLICATE_EMAIL");
    if (normalizedEmail) seenEmails.add(normalizedEmail);
    if (!isValidCandidateBirthDate(candidate?.birthDate, now)) pushReason(reasons, "MISSING_BIRTH_DATE");

    if (reasons.length) {
      excluded.push({
        candidateId: candidate?.id ?? "",
        candidateNumber: candidate?.candidateNumber ?? "",
        candidateName: candidate?.name ?? "응시자",
        reasons
      });
    } else {
      eligible.push(candidate);
    }
  }

  return {
    totalCandidateCount: sameOrganizationCandidates.length,
    eligibleCandidates: eligible,
    excludedCandidates: excluded,
    eligibleCandidateCount: eligible.length,
    excludedCandidateCount: excluded.length
  };
};

export const assertCanStartExamOperations = ({ exam, manager, managedOrganizationIds = [], questionCount = 0, candidatePreview, startsAt, endsAt, now = Date.now() }) => {
  if (!exam) throw new ExamOperationsAgentError("EXAM_NOT_FOUND", "시험을 찾을 수 없습니다.", 404);
  if (!managedOrganizationIds.includes(exam.organizationId)) {
    throw new ExamOperationsAgentError("FORBIDDEN_EXAM_SCOPE", "해당 조직·시험의 자동 운영 권한이 없습니다.", 403);
  }
  if (!manager?.id) throw new ExamOperationsAgentError("MANAGER_REQUIRED", "자동 운영을 시작한 관리자를 확인할 수 없습니다.", 403);
  if (questionCount < 1) throw new ExamOperationsAgentError("NO_QUESTIONS", "저장된 문제가 있어야 자동 시험 운영을 시작할 수 있습니다.", 409);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new ExamOperationsAgentError("INVALID_EXAM_SCHEDULE", "시험 일정과 제한 시간이 올바르지 않습니다.", 409);
  }
  if (Date.parse(endsAt) <= now) throw new ExamOperationsAgentError("EXAM_ALREADY_ENDED", "이미 종료된 시험은 자동 운영을 시작할 수 없습니다.", 409);
  if (!candidatePreview?.eligibleCandidateCount) throw new ExamOperationsAgentError("NO_ELIGIBLE_CANDIDATES", "자동 배정 가능한 유효 응시자가 없습니다.", 409);
};

export const isInvitationLocked = (invitations = [], examId) => invitations.some((invitation) =>
  invitation.examId === examId
  && !invitation.revokedAt
  && ["SENT", "PREVIEW"].includes(String(invitation.deliveryStatus ?? "").toUpperCase())
);
