import express from "express";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createStore, verifyPassword } from "./store.mjs";
import { createAiProctor } from "./aiProctor.mjs";

const roles = new Set(["APPLICANT", "MANAGER", "SUPERVISOR", "ADMIN"]);
const isNonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
const publicUser = ({ password, passwordHash, organizationIds, ...user }) => user;
const isManagerRole = (role) => role === "MANAGER" || role === "SUPERVISOR";
const sessionTtlMs = 8 * 60 * 60 * 1000;
const applicantSessionTtlMs = 4 * 60 * 60 * 1000;
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const scheduledExamEndsAt = (exam) => {
  const schedule = String(exam.date ?? "").trim().match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  const durationMinutes = Number.parseInt(String(exam.duration ?? "").match(/\d+/)?.[0] ?? "", 10);
  if (!schedule || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return undefined;
  const [, year, month, day, hour, minute] = schedule;
  const startsAt = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (
    Number.isNaN(startsAt.getTime())
    || startsAt.getFullYear() !== Number(year)
    || startsAt.getMonth() !== Number(month) - 1
    || startsAt.getDate() !== Number(day)
    || startsAt.getHours() !== Number(hour)
    || startsAt.getMinutes() !== Number(minute)
  ) return undefined;
  return new Date(startsAt.getTime() + durationMinutes * 60 * 1000).toISOString();
};
const managerOrganizationIds = (user, organizations) => organizations
  .filter((organization) => user.approvalStatus === "APPROVED" && organization.status === "APPROVED" && (organization.managerIds?.includes(user.id) || user.organizationIds?.includes(organization.id)))
  .map((organization) => organization.id);
const publicOrganization = (organization, users) => ({
  ...organization,
  managers: (organization.managerIds ?? []).map((id) => users.find((user) => user.id === id)).filter(Boolean).map(publicUser)
});
const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const aiProviderModels = {
  OpenAI: new Set(["gpt-5.6", "gpt-5.5", "gpt-5.4", "o3", "o3-mini", "gpt-4o", "gpt-4o-mini", "gpt-live", "gpt-realtime", "gpt-4.1-mini"]),
  Anthropic: new Set(["claude-opus-5", "claude-sonnet-5", "claude-fable-5", "claude-opus-4.8", "claude-sonnet-4.6", "claude-haiku-4.5", "claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"]),
  "Google Gemini": new Set(["gemini-3.5-flash", "gemini-3.1-pro", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.0-flash"]),
  DeepSeek: new Set(["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-v3.2", "deepseek-r1"]),
  Cohere: new Set(["command-a-plus", "command-a", "north-mini-code", "rerank-4-pro", "embed-4"]),
  "Mistral AI": new Set(["mistral-large-3", "mistral-small-4", "codestral", "pixtral"]),
  "Meta (Together AI, Groq 등)": new Set(["llama-3.3", "llama-3.2"])
};
const currentUsageMonth = (date = new Date()) => date.toISOString().slice(0, 7);
const defaultOrganizationAiPolicy = (usageMonth = currentUsageMonth()) => ({ enabled: false, monthlyLimit: 0, monthlyUsage: 0, usageMonth });
const verificationCodeHash = (code) => createHash("sha256").update(code).digest("hex");
const verificationTtlMs = 10 * 60 * 1000;
const verificationCooldownMs = 60 * 1000;
const maxVerificationAttempts = 5;
const loginLockoutMs = 15 * 60 * 1000;
const loginFailureLimit = 5;
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
const sendSendGridEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return false;
  const delivery = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: fromEmail, ...(process.env.SENDGRID_FROM_NAME ? { name: process.env.SENDGRID_FROM_NAME } : {}) },
      content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }]
    }),
    signal: AbortSignal.timeout(5000)
  });
  if (!delivery.ok) throw new Error("SendGrid email delivery failed");
  return true;
};
const isValidBirthDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date <= new Date();
};
const normalizeResidentNumberFront = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^\d{6}$/.test(digits)) return digits;
  if (/^\d{8}$/.test(digits)) return digits.slice(-6);
  return "";
};
const residentNumberFrontFromOcr = (payload) => {
  const candidate = payload?.residentNumberFront
    ?? payload?.birthDate
    ?? payload?.data?.residentNumberFront
    ?? payload?.data?.birthDate
    ?? payload?.result?.residentNumberFront
    ?? payload?.result?.birthDate;
  return normalizeResidentNumberFront(candidate);
};
const normalizeIdentityName = (value) => String(value ?? "").replace(/\s/g, "").toLowerCase();
const nameMatchedFromOcr = (payload, expectedName) => {
  if (payload?.nameMatched === true) return true;
  const recognizedName = payload?.name ?? payload?.data?.name ?? payload?.result?.name;
  const recognizedText = payload?.recognizedText ?? payload?.text ?? payload?.data?.recognizedText ?? payload?.result?.recognizedText;
  const expected = normalizeIdentityName(expectedName);
  return normalizeIdentityName(recognizedName) === expected || normalizeIdentityName(recognizedText).includes(expected);
};
const requestIdCardOcr = async (path, payload) => {
  const configuredEndpoint = process.env.ID_CARD_OCR_URL?.trim().replace(/\/$/, "");
  const baseEndpoint = configuredEndpoint?.replace(/\/ocr\/id-card(?:\/detect)?$/, "");
  if (!baseEndpoint) {
    const error = new Error("신분증 OCR 모델이 아직 설정되지 않았습니다. 서버 환경변수 ID_CARD_OCR_URL을 등록해주세요.");
    error.status = 503;
    throw error;
  }
  const headers = { "Content-Type": "application/json" };
  const apiKey = process.env.ID_CARD_OCR_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  let ocrResponse;
  try {
    ocrResponse = await fetch(`${baseEndpoint}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180_000)
    });
  } catch (reason) {
    const error = new Error(reason?.name === "TimeoutError"
      ? "OCR 모델을 준비하는 데 시간이 오래 걸리고 있습니다. 잠시 후 다시 촬영해주세요."
      : "신분증 OCR 서비스에 연결하지 못했습니다. OCR 서비스 배포 상태와 주소를 확인해주세요.");
    error.status = 503;
    throw error;
  }
  if (!ocrResponse.ok) {
    const result = await ocrResponse.json().catch(() => ({}));
    const error = new Error(typeof result?.detail === "string" ? result.detail : "신분증 OCR 모델이 이미지를 처리하지 못했습니다.");
    error.status = ocrResponse.status >= 500 ? 502 : ocrResponse.status;
    throw error;
  }
  return ocrResponse.json();
};
const verifyIdCardWithOcr = async (image, expectedName) => {
  const payload = await requestIdCardOcr("/ocr/id-card", { image, expectedName });
  const residentNumberFront = residentNumberFrontFromOcr(payload);
  if (!residentNumberFront) {
    const error = new Error("신분증에서 주민번호 앞 6자리를 읽지 못했습니다. 빛 반사를 피해서 다시 촬영해주세요.");
    error.status = 422;
    throw error;
  }
  return { residentNumberFront, nameMatched: nameMatchedFromOcr(payload, expectedName) };
};
const detectIdCardWithOcr = async (image) => requestIdCardOcr("/ocr/id-card/detect", { image });
const invitationForToken = (invitations, token) => invitations.find((invitation) => invitation.tokenHash === hashToken(token));
const codingLanguages = new Set(["Python", "Java", "C", "JavaScript"]);
const executionLanguageIds = { Python: 71, Java: 62, C: 50 };
const executionOutputLimit = 20_000;
const executionResponseLimit = 1_000_000;
const executionWindowMs = 60_000;
const executionRequestLimit = 20;
const executionConcurrentLimit = 2;
const judgeModes = new Set(["EXACT", "IGNORE_WHITESPACE", "NUMERIC_TOLERANCE", "CUSTOM"]);
const normalizeTestCases = (testCases, requireAtLeastOne = false) => {
  if (!Array.isArray(testCases)) return undefined;
  const normalized = testCases.map((testCase) => ({
    input: typeof testCase?.input === "string" ? testCase.input.trim() : "",
    expectedOutput: typeof testCase?.expectedOutput === "string" ? testCase.expectedOutput.trim() : "",
    explanation: typeof testCase?.explanation === "string" ? testCase.explanation.trim() : ""
  }));
  if ((requireAtLeastOne && normalized.length === 0) || normalized.some((testCase) => !testCase.input || !testCase.expectedOutput)) return undefined;
  return normalized;
};
const publicQuestion = ({ answer, hiddenTestCases, referenceSolutions, customJudgeCode, ...question }) => question;
const normalizeCodingAnswers = (answers, questions) => Object.fromEntries(questions.map((question) => {
  if (question.type !== "CODING") return [question.id, typeof answers[question.id] === "string" ? answers[question.id].slice(0, 10000) : ""];
  const answer = answers[question.id] && typeof answers[question.id] === "object" ? answers[question.id] : {};
  const languages = question.languages?.length ? question.languages : ["Python", "JavaScript"];
  return [question.id, {
    language: languages.includes(answer.language) ? answer.language : languages[0],
    source: typeof answer.source === "string" ? answer.source.slice(0, 100000) : ""
  }];
}));
const normalizeRunResults = (runResults, questions) => Object.fromEntries(questions.filter((question) => question.type === "CODING").flatMap((question) => {
  const result = runResults?.[question.id];
  if (!result || typeof result !== "object" || typeof result.output !== "string") return [];
  return [[question.id, { type: ["success", "error", "notice"].includes(result.type) ? result.type : "notice", output: result.output.slice(0, 20000), executedAt: typeof result.executedAt === "string" ? result.executedAt : new Date().toISOString() }]];
}));

const defaultCodeExecutionUrl = "https://ce.judge0.com";
export const resolveCodeExecutionUrl = (value = process.env.CODE_EXECUTION_API_URL) => value?.trim() || defaultCodeExecutionUrl;
export const resolveCodeExecutionAllowedHosts = (value = process.env.CODE_EXECUTION_API_ALLOWED_HOSTS, production = process.env.NODE_ENV === "production") => {
  const configuredHosts = value?.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean) ?? [];
  return configuredHosts.length > 0 ? configuredHosts : (production ? ["ce.judge0.com"] : []);
};

const normalizeExecutionUrl = (value, { production = false, allowedHosts = [] } = {}) => {
  if (!value) return "";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("코드 실행 서버 주소가 올바르지 않습니다.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("코드 실행 서버 주소는 인증정보·쿼리·프래그먼트가 없는 HTTP(S) 주소여야 합니다.");
  }
  if (production && parsed.protocol !== "https:") throw new Error("운영 환경의 코드 실행 서버는 HTTPS 주소여야 합니다.");
  if (production && (!allowedHosts.length || !allowedHosts.includes(parsed.hostname))) throw new Error("운영 환경의 코드 실행 서버 호스트가 허용목록에 없습니다.");
  return parsed.toString().replace(/\/$/, "");
};

const parseExecutionResponse = async (response) => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("코드 실행 서버 응답을 읽을 수 없습니다.");
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > executionResponseLimit) {
      await reader.cancel();
      throw new Error("코드 실행 서버 응답이 너무 큽니다.");
    }
    chunks.push(value);
  }
  const payload = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error("코드 실행 서버 응답 형식이 올바르지 않습니다.");
  }
};
const executionStatusId = (result) => Number(result?.status_id ?? result?.status?.id);

const executeCode = async ({ baseUrl, language, source, stdin }) => {
  const languageId = executionLanguageIds[language];
  const deadline = Date.now() + 15_000;
  const headers = { "Content-Type": "application/json" };
  const apiKey = process.env.CODE_EXECUTION_API_KEY?.trim();
  if (apiKey) headers["X-Auth-Token"] = apiKey;
  const fetchWithinDeadline = async (url, options = {}) => {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error("코드 실행 시간이 초과되었습니다.");
    return fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(Math.min(remainingMs, options.timeout ?? remainingMs)) });
  };
  try {
    let executionResponse = await fetchWithinDeadline(`${baseUrl}/submissions?base64_encoded=false&wait=false`, {
      method: "POST",
      headers,
      body: JSON.stringify({ language_id: languageId, source_code: source, stdin, cpu_time_limit: 3, wall_time_limit: 5, memory_limit: 256000 }),
    });
    if (!executionResponse.ok) {
      const error = new Error("코드 실행 서버가 요청을 처리하지 못했습니다.");
      error.status = 502;
      throw error;
    }
    let result = await parseExecutionResponse(executionResponse);
    for (let attempt = 0; result.token && (Number.isNaN(executionStatusId(result)) || [1, 2].includes(executionStatusId(result))) && attempt < 20; attempt += 1) {
      await new Promise((resolveReady) => setTimeout(resolveReady, 250));
      const statusResponse = await fetchWithinDeadline(`${baseUrl}/submissions/${encodeURIComponent(result.token)}?base64_encoded=false`, { headers, timeout: 3_000 });
      if (!statusResponse.ok) break;
      result = await parseExecutionResponse(statusResponse);
    }
    const statusId = executionStatusId(result);
    if ([1, 2].includes(statusId)) {
      const error = new Error("코드 실행 서버가 제한 시간 안에 결과를 반환하지 않았습니다.");
      error.status = 504;
      throw error;
    }
    if (Number.isNaN(statusId)) {
      const error = new Error("코드 실행 서버 응답에 실행 상태가 없습니다.");
      error.status = 502;
      throw error;
    }
    const rawOutput = [result.stdout, result.stderr, result.compile_output, result.message, result.status?.description]
      .find((value) => typeof value === "string" && value.trim())?.trimEnd() ?? "출력이 없습니다.";
    const truncationNotice = "\n[출력이 길어 일부 생략되었습니다.]";
    const output = rawOutput.length > executionOutputLimit ? `${rawOutput.slice(0, executionOutputLimit - truncationNotice.length)}${truncationNotice}` : rawOutput;
    return { type: statusId === 3 ? "success" : "error", output, status: result.status?.description ?? "실행 완료" };
  } catch (reason) {
    if (reason.status) throw reason;
    const error = new Error(reason?.name === "TimeoutError" || reason?.message === "코드 실행 시간이 초과되었습니다."
      ? "코드 실행 시간이 초과되었습니다."
      : reason?.message === "코드 실행 서버 응답이 너무 큽니다." || reason?.message === "코드 실행 서버 응답 형식이 올바르지 않습니다."
        ? reason.message
        : "코드 실행 서버에 연결하지 못했습니다.");
    error.status = 503;
    throw error;
  }
};

const requestUser = (sessions, users, removeSession) => (request, response, next) => {
  const token = request.header("authorization")?.replace("Bearer ", "");
  const session = token ? sessions.get(hashToken(token)) : undefined;
  if (!session || new Date(session.expiresAt) <= new Date()) {
    if (session) {
      sessions.delete(session.tokenHash);
      void removeSession(session.tokenHash);
    }
    return response.status(401).json({ message: "로그인이 필요합니다." });
  }
  const user = users.find((candidate) => candidate.id === session.userId);
  if (!user) return response.status(401).json({ message: "로그인이 필요합니다." });
  if (isManagerRole(user.role) && user.approvalStatus !== "APPROVED") {
    sessions.delete(session.tokenHash);
    void removeSession(session.tokenHash);
    return response.status(403).json({ message: "관리자 계정이 승인 상태가 아닙니다." });
  }
  request.user = user;
  return next();
};

const requireRole = (role) => (request, response, next) => {
  if (request.user.role !== role) return response.status(403).json({ message: "권한이 없습니다." });
  return next();
};

const requireManager = (request, response, next) => {
  if (!isManagerRole(request.user.role)) return response.status(403).json({ message: "관리자 권한이 필요합니다." });
  return next();
};

export const createApp = async ({ databasePath = resolve("data/database.json"), aiSettingsEncryptionKey = process.env.AI_SETTINGS_ENCRYPTION_KEY, codeExecutionUrl = resolveCodeExecutionUrl(), aiProctorOptions = {} } = {}) => {
  const store = await createStore(databasePath);
  const sessions = new Map(store.sessions.map((session) => [session.tokenHash, session]));
  const loginFailures = new Map();
  const candidateFailures = new Map();
  const liveSessions = new Map();
  const auxiliaryDevices = new Map(store.auxiliaryDevices.map((device) => [device.token, device]));
  const idCardScans = new Map(store.idCardScans.map((scan) => [scan.token, scan]));
  const app = express();
  const aiProctor = createAiProctor({
    ...aiProctorOptions,
    onResult: async (job, result) => {
      const examinee = store.examinees.find((item) => item.id === job.examineeId && item.examId === job.examId && item.candidateId === job.candidateId);
      if (!examinee?.monitoringSnapshot) return;
      await store.updateExaminee(examinee.id, { monitoringSnapshot: { ...examinee.monitoringSnapshot, ai: { ...result, sourceSnapshotAt: job.snapshotUpdatedAt } } });
      await aiProctorOptions.onResult?.(job, result);
    },
    onWarning: async (job, event) => {
      const examinee = store.examinees.find((item) => item.id === job.examineeId && item.examId === job.examId && item.candidateId === job.candidateId);
      if (!examinee) return;
      await store.addWarning({ id: randomUUID(), examineeId: examinee.id, examId: examinee.examId, organizationId: examinee.organizationId, type: event.type, confidence: event.confidence, message: event.message, source: "AI", createdAt: new Date().toISOString() });
      await aiProctorOptions.onWarning?.(job, event);
    }
  });
  app.locals.aiProctor = aiProctor;
  const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:5174").split(",").map((origin) => origin.trim()).filter(Boolean));
  const executionAllowedHosts = resolveCodeExecutionAllowedHosts();
  let normalizedCodeExecutionUrl = "";
  let codeExecutionConfigError = "";
  try {
    normalizedCodeExecutionUrl = normalizeExecutionUrl(codeExecutionUrl, { production: process.env.NODE_ENV === "production", allowedHosts: executionAllowedHosts });
  } catch (error) {
    codeExecutionConfigError = error.message;
  }
  const executionUsage = new Map();
  const acquireExecutionSlot = (key) => {
    const now = Date.now();
    const usage = executionUsage.get(key);
    const current = usage && now - usage.windowStarted < executionWindowMs ? usage : { windowStarted: now, requestCount: 0, inFlight: 0 };
    if (current.requestCount >= executionRequestLimit || current.inFlight >= executionConcurrentLimit) {
      const error = new Error("코드 실행 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      error.status = 429;
      throw error;
    }
    current.requestCount += 1;
    current.inFlight += 1;
    executionUsage.set(key, current);
    return () => {
      current.inFlight = Math.max(0, current.inFlight - 1);
      if (current.inFlight === 0 && Date.now() - current.windowStarted >= executionWindowMs) executionUsage.delete(key);
    };
  };
  const publicWebOrigin = process.env.PUBLIC_WEB_ORIGIN || (process.env.RENDER === "true" ? "https://aivle-frontend-gakg.onrender.com" : "http://localhost:5173");
  const invitationStatus = (invitation, now = new Date()) => {
    if (invitation.submittedAt) return "SUBMITTED";
    if (invitation.revokedAt) return "REVOKED";
    if (new Date(invitation.expiresAt) <= now) return "EXPIRED";
    return "ACTIVE";
  };
  const publicAdminInvitation = (invitation) => {
    const organization = store.organizations.find((item) => item.id === invitation.organizationId);
    const exam = store.exams.find((item) => item.id === invitation.examId);
    const candidate = store.candidates.find((item) => item.id === invitation.candidateId);
    const assignment = store.assignments.find((item) => item.examId === invitation.examId && item.candidateId === invitation.candidateId);
    const examinee = store.examinees.find((item) => item.examId === invitation.examId && item.candidateId === invitation.candidateId);
    const gradingRequest = store.aiGradingRequests.find((item) => item.examId === invitation.examId && item.candidateId === invitation.candidateId && ["PENDING", "PROCESSING", "COMPLETED", "FAILED"].includes(item.status));
    const examProgress = invitation.submittedAt ? "SUBMITTED" : invitation.verifiedAt ? "IN_PROGRESS" : "NOT_STARTED";
    const diagnosisStatus = !invitation.submittedAt ? "NOT_READY" : assignment?.aiGradingStatus === "COMPLETED" || gradingRequest?.status === "COMPLETED" ? "COMPLETED" : gradingRequest?.status ?? "NOT_REQUESTED";
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      organizationName: organization?.name ?? "알 수 없는 조직",
      examId: invitation.examId,
      examTitle: exam?.title ?? "알 수 없는 시험",
      candidateId: invitation.candidateId,
      candidateName: candidate?.name ?? "알 수 없는 응시자",
      candidateEmail: candidate?.email ?? "",
      sentAt: invitation.sentAt,
      expiresAt: invitation.expiresAt,
      verifiedAt: invitation.verifiedAt,
      submittedAt: invitation.submittedAt,
      revokedAt: invitation.revokedAt,
      revokedReason: invitation.revokedReason,
      deliveryStatus: invitation.deliveryStatus ?? "PREVIEW",
      status: invitationStatus(invitation),
      examProgress,
      examineeStatus: examinee?.status ?? "NOT_STARTED",
      examineeStatusText: examinee?.statusText ?? "미접속",
      diagnosisStatus,
      resultStatus: assignment?.resultStatus ?? "NOT_SUBMITTED"
    };
  };
  const addInvitationAudit = (action, actor, details = {}) => store.addInvitationAuditLog({ id: randomUUID(), action, actorId: actor.id, actorName: actor.name, createdAt: new Date().toISOString(), ...details });
  const encryptAiApiKey = (apiKey) => {
    if (!aiSettingsEncryptionKey) return undefined;
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(aiSettingsEncryptionKey).digest(), initializationVector);
    const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
    return `${initializationVector.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
  };
  const decryptAiApiKey = (encryptedValue) => {
    if (!encryptedValue || !aiSettingsEncryptionKey) return undefined;
    const [iv, authTag, encrypted] = encryptedValue.split(".");
    if (!iv || !authTag || !encrypted) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(aiSettingsEncryptionKey).digest(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(authTag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
  };
  const organizationAiSettings = () => {
    const usageMonth = currentUsageMonth();
    return store.organizations.map((organization) => {
      const saved = store.organizationAiPolicies[organization.id] ?? defaultOrganizationAiPolicy(usageMonth);
      return {
        organizationId: organization.id,
        organizationName: organization.name,
        enabled: saved.enabled === true,
        monthlyLimit: Number.isSafeInteger(saved.monthlyLimit) && saved.monthlyLimit >= 0 ? saved.monthlyLimit : 0,
        monthlyUsage: saved.usageMonth === usageMonth && Number.isSafeInteger(saved.monthlyUsage) && saved.monthlyUsage >= 0 ? saved.monthlyUsage : 0,
        usageMonth
      };
    });
  };
  const publicAiSettings = () => ({
    provider: store.systemPolicies.aiProvider,
    model: store.systemPolicies.aiModel,
    apiKeyConfigured: Boolean(process.env.AI_API_KEY || store.systemPolicies.aiEncryptedApiKey),
    organizations: organizationAiSettings()
  });
  const publicAiGradingRequest = (item) => {
    const organization = store.organizations.find((candidate) => candidate.id === item.organizationId);
    const candidate = store.candidates.find((candidate) => candidate.id === item.candidateId);
    const exam = store.exams.find((exam) => exam.id === item.examId);
    return { ...item, organizationName: organization?.name ?? "알 수 없는 조직", candidateName: candidate?.name ?? "알 수 없는 응시자", examTitle: exam?.title ?? "알 수 없는 시험" };
  };
  const invokeAiGrading = async ({ apiKey, provider, model, prompt }) => {
    const requestOptions = { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000) };
    let response;
    if (provider === "OpenAI") {
      requestOptions.headers.Authorization = `Bearer ${apiKey}`;
      requestOptions.body = JSON.stringify({ model, messages: [{ role: "system", content: "You are an exam grader. Return concise JSON with score, feedback, and rubricBreakdown." }, { role: "user", content: prompt }], response_format: { type: "json_object" } });
      response = await fetch("https://api.openai.com/v1/chat/completions", requestOptions);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI 채점 호출에 실패했습니다.");
      return JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    }
    if (provider === "Anthropic") {
      requestOptions.headers["x-api-key"] = apiKey;
      requestOptions.headers["anthropic-version"] = "2023-06-01";
      requestOptions.body = JSON.stringify({ model, max_tokens: 1200, system: "You are an exam grader. Return JSON with score, feedback, and rubricBreakdown.", messages: [{ role: "user", content: prompt }] });
      response = await fetch("https://api.anthropic.com/v1/messages", requestOptions);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Anthropic 채점 호출에 실패했습니다.");
      return JSON.parse(payload.content?.[0]?.text ?? "{}");
    }
    if (provider === "Google Gemini") {
      requestOptions.body = JSON.stringify({ contents: [{ role: "user", parts: [{ text: `You are an exam grader. Return JSON with score, feedback, and rubricBreakdown.\n${prompt}` }] }], generationConfig: { responseMimeType: "application/json" } });
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, requestOptions);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Gemini 채점 호출에 실패했습니다.");
      return JSON.parse(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    }
    throw new Error(`${provider} 채점 어댑터는 아직 서버에 구성되지 않았습니다.`);
  };
  const executeAiGrading = async (request) => {
    const apiKey = process.env.AI_API_KEY || decryptAiApiKey(store.systemPolicies.aiEncryptedApiKey);
    if (!apiKey) throw new Error("등록된 중앙 AI API 키가 없습니다.");
    const submission = store.codingSubmissions.find((item) => item.examId === request.examId && item.candidateId === request.candidateId);
    const questions = store.questions.filter((item) => item.examId === request.examId).map((item) => ({ id: item.id, title: item.title, type: item.type, description: item.description, rubric: item.rubric }));
    const prompt = JSON.stringify({ examId: request.examId, candidateId: request.candidateId, questions, submission: submission ? { answers: submission.answers, submittedAt: submission.submittedAt } : null });
    const grading = await invokeAiGrading({ apiKey, provider: store.systemPolicies.aiProvider, model: store.systemPolicies.aiModel, prompt });
    const result = { ...grading, provider: store.systemPolicies.aiProvider, model: store.systemPolicies.aiModel, gradedAt: new Date().toISOString() };
    await store.updateAiGradingRequest(request.id, { status: "COMPLETED", completedAt: result.gradedAt, result });
    const assignment = store.assignments.find((item) => item.examId === request.examId && item.candidateId === request.candidateId);
    if (assignment) await store.updateAssignment(assignment.id, { aiGradingStatus: "COMPLETED", aiGradingResult: result, aiGradedAt: result.gradedAt });
  };
  const verifyAiApiKey = async ({ provider, apiKey }) => {
    const checks = {
      OpenAI: { url: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${apiKey}` } },
      Anthropic: { url: "https://api.anthropic.com/v1/models", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } },
      "Google Gemini": { url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, headers: {} }
    };
    const check = checks[provider];
    if (!check) return { valid: false, message: "지원하지 않는 AI 제공자입니다." };
    try {
      const result = await fetch(check.url, { headers: check.headers, signal: AbortSignal.timeout(8000) });
      return result.ok ? { valid: true, message: "API 키가 유효합니다." } : { valid: false, message: "API 키가 유효하지 않거나 제공자 접근 권한이 없습니다." };
    } catch {
      return { valid: false, message: "AI 제공자에 연결하지 못했습니다. 네트워크와 키를 확인하세요." };
    }
  };

  app.use(express.json({ limit: "6mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use((request, response, next) => {
    const origin = request.header("origin");
    if (origin && allowedOrigins.has(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("Vary", "Origin");
    if (request.method === "OPTIONS") return response.sendStatus(204);
    return next();
  });

  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/api/exams", (_request, response) => response.status(403).json({ message: "시험은 초대 메일의 링크로만 입장할 수 있습니다." }));
  const publicNotice = (notice) => ({
    id: notice.id,
    title: notice.title,
    content: notice.content ?? "",
    category: notice.category ?? "GENERAL",
    scope: notice.scope ?? "GLOBAL",
    organizationId: notice.organizationId ?? null,
    examId: notice.examId ?? null,
    organizationName: notice.organizationId ? store.organizations.find((item) => item.id === notice.organizationId)?.name ?? null : null,
    examTitle: notice.examId ? store.exams.find((item) => item.id === notice.examId)?.title ?? null : null,
    pinned: Boolean(notice.pinned),
    publishedAt: notice.publishedAt ?? notice.date ?? null,
    publishStartAt: notice.publishStartAt ?? null,
    publishEndAt: notice.publishEndAt ?? null,
    viewCount: notice.viewCount ?? 0,
    createdAt: notice.createdAt ?? null,
    updatedAt: notice.updatedAt ?? null
  });
  const isPublishedNotice = (notice, now = new Date()) =>
    (!notice.publishStartAt || new Date(notice.publishStartAt) <= now)
    && (!notice.publishEndAt || new Date(notice.publishEndAt) >= now);
  const noticeSort = (first, second) =>
    Number(Boolean(second.pinned)) - Number(Boolean(first.pinned))
    || new Date(second.publishedAt ?? second.date ?? 0) - new Date(first.publishedAt ?? first.date ?? 0);
  const normalizeNoticeInput = (body) => {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const categories = new Set(["GENERAL", "EXAM", "MAINTENANCE", "URGENT"]);
    const category = categories.has(body.category) ? body.category : "GENERAL";
    const parseOptionalDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    };
    return {
      title,
      content,
      category,
      pinned: body.pinned === true,
      publishStartAt: parseOptionalDate(body.publishStartAt),
      publishEndAt: parseOptionalDate(body.publishEndAt)
    };
  };

  app.get("/api/notices", (request, response) => {
    const query = String(request.query.q ?? "").trim().toLowerCase();
    const category = String(request.query.category ?? "").trim();
    const notices = store.notices
      .filter((notice) => (notice.scope ?? "GLOBAL") === "GLOBAL")
      .filter((notice) => isPublishedNotice(notice))
      .filter((notice) => !category || category === "ALL" || (notice.category ?? "GENERAL") === category)
      .filter((notice) => !query || `${notice.title} ${notice.content ?? ""}`.toLowerCase().includes(query))
      .sort(noticeSort)
      .map(publicNotice);
    response.json(notices);
  });
  app.get("/api/notices/:id", async (request, response, next) => {
    try {
      const notice = store.notices.find((item) => item.id === request.params.id);
      if (!notice || (notice.scope ?? "GLOBAL") !== "GLOBAL" || !isPublishedNotice(notice)) return response.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      const updated = await store.updateNotice(notice.id, { viewCount: (notice.viewCount ?? 0) + 1 });
      return response.json(publicNotice(updated));
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/email-verification/send", async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body.email);
      if (!isValidEmail(email)) return response.status(400).json({ message: "올바른 이메일 주소를 입력해주세요." });
      if (store.users.some((user) => user.email === email)) return response.status(409).json({ message: "이미 등록된 이메일입니다." });
      const previous = store.emailVerifications.find((item) => item.email === email && !item.verifiedAt);
      if (previous && Date.now() - new Date(previous.sentAt).getTime() < verificationCooldownMs) return response.status(429).json({ message: "인증번호는 1분 후 다시 요청할 수 있습니다." });
      const code = String(randomInt(100000, 1000000));
      const verification = { id: randomUUID(), email, codeHash: verificationCodeHash(code), sentAt: new Date().toISOString(), expiresAt: new Date(Date.now() + verificationTtlMs).toISOString(), attempts: 0, verifiedAt: null, verificationTokenHash: null };
      let deliveryStatus;
      try {
        deliveryStatus = await sendSendGridEmail({
          to: email,
          subject: "[Aivle] 관리자 회원가입 인증번호",
          html: "<p>관리자 회원가입 인증번호는 <strong>" + code + "</strong>입니다.</p><p>인증번호는 10분 동안 유효합니다.</p>",
          text: "관리자 회원가입 인증번호는 " + code + "입니다. 인증번호는 10분 동안 유효합니다."
        }) ? "SENT" : "PREVIEW";
      } catch {
        return response.status(502).json({ message: "인증 메일 전송에 실패했습니다." });
      }
      if (deliveryStatus === "PREVIEW" && (process.env.NODE_ENV === "production" || process.env.SENDGRID_API_KEY || process.env.SENDGRID_FROM_EMAIL)) return response.status(503).json({ message: "SendGrid 이메일 서비스가 아직 설정되지 않았습니다." });
      await store.addEmailVerification(verification);
      return response.status(201).json({ verificationId: verification.id, deliveryStatus, expiresAt: verification.expiresAt, ...(deliveryStatus === "PREVIEW" ? { previewCode: code } : {}) });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/email-verification/confirm", async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body.email);
      const verificationId = typeof request.body.verificationId === "string" ? request.body.verificationId : "";
      const code = typeof request.body.code === "string" ? request.body.code.trim() : "";
      const verification = store.emailVerifications.find((item) => item.id === verificationId && item.email === email && !item.verifiedAt);
      if (!verification || new Date(verification.expiresAt) <= new Date()) return response.status(410).json({ message: "인증번호가 만료되었습니다. 다시 요청해주세요." });
      if (verification.attempts >= maxVerificationAttempts) return response.status(429).json({ message: "인증번호 입력 횟수를 초과했습니다. 다시 요청해주세요." });
      if (!/^\d{6}$/.test(code) || verificationCodeHash(code) !== verification.codeHash) {
        const attempts = verification.attempts + 1;
        await store.updateEmailVerification(verification.id, { attempts });
        return response.status(401).json({ message: `인증번호가 올바르지 않습니다. (${maxVerificationAttempts - attempts}회 남음)` });
      }
      const verificationToken = randomUUID();
      await store.updateEmailVerification(verification.id, { verifiedAt: new Date().toISOString(), verificationTokenHash: hashToken(verificationToken) });
      return response.json({ verificationToken, email });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/signup", async (request, response, next) => {
    try {
      const { name, password, role, verificationToken } = request.body;
      const email = normalizeEmail(request.body.email);
      const verification = store.emailVerifications.find((item) => item.email === email && item.verifiedAt && item.verificationTokenHash === hashToken(typeof verificationToken === "string" ? verificationToken : ""));
      if (!isNonEmptyText(name) || !isValidEmail(email) || !isNonEmptyText(password) || !verification || new Date(verification.expiresAt) <= new Date() || (role && role !== "MANAGER")) {
        return response.status(400).json({ message: "회원가입 정보를 다시 확인해주세요." });
      }
      if (password.trim().length < 8) return response.status(400).json({ message: "비밀번호는 8자 이상 입력해주세요." });
      if (store.users.some((user) => user.email === email)) return response.status(409).json({ message: "이미 등록된 이메일입니다." });
      const user = { id: randomUUID(), name: name.trim(), email, password, role: "MANAGER", approvalStatus: "PENDING", organizationIds: [] };
      await store.addUser(user);
      await store.updateEmailVerification(verification.id, { consumedAt: new Date().toISOString() });
      return response.status(201).json({ user: publicUser(user), message: "관리자 가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다." });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/login", async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body.email);
      const { password, role } = request.body;
      const key = `${request.ip}:${email}`;
      const lock = loginFailures.get(key);
      if (lock?.blockedUntil && lock.blockedUntil > Date.now()) return response.status(429).json({ message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." });
      const user = store.users.find((candidate) => candidate.email === email);
      const roleMatches = user && (!role || user.role === role || (isManagerRole(user.role) && isManagerRole(role)));
      if (!roleMatches || user.role === "APPLICANT" || role === "APPLICANT" || user.approvalStatus !== "APPROVED" || !(await verifyPassword(password ?? "", user.passwordHash))) {
        if (user && user.approvalStatus !== "APPROVED") return response.status(403).json({ message: "관리자 승인 후 로그인할 수 있습니다." });
        const failures = (loginFailures.get(key)?.failures ?? 0) + 1;
        loginFailures.set(key, { failures, blockedUntil: failures >= loginFailureLimit ? Date.now() + loginLockoutMs : 0 });
        return response.status(401).json({ message: "이메일, 비밀번호 또는 권한을 확인해주세요." });
      }
      loginFailures.delete(key);
      const token = randomUUID();
      const safeUser = publicUser(user);
      const session = { tokenHash: hashToken(token), userId: user.id, role: user.role, expiresAt: new Date(Date.now() + sessionTtlMs).toISOString() };
      sessions.set(session.tokenHash, session);
      await store.addSession(session);
      return response.json({ token, user: safeUser });
    } catch (error) {
      return next(error);
    }
  });

  const authenticate = requestUser(sessions, store.users, (tokenHash) => store.removeSession(tokenHash));
  const authenticateApplicant = async (request, response, next) => {
    const token = request.header("authorization")?.replace("Bearer ", "");
    const session = token ? sessions.get(hashToken(token)) : undefined;
    if (!session || session.role !== "APPLICANT" || new Date(session.expiresAt) <= new Date()) {
      if (session) {
        sessions.delete(session.tokenHash);
        await store.removeSession(session.tokenHash);
      }
      return response.status(401).json({ message: "유효한 시험 응시 세션이 필요합니다." });
    }
    const invitation = store.invitations.find((candidate) => candidate.id === session.invitationId);
    const candidate = invitation && store.candidates.find((item) => item.id === invitation.candidateId);
    const exam = invitation && store.exams.find((item) => item.id === invitation.examId);
    if (!invitation || !candidate || !exam || invitation.revokedAt || new Date(invitation.expiresAt) <= new Date()) {
      if (session) {
        sessions.delete(session.tokenHash);
        await store.removeSession(session.tokenHash);
      }
      return response.status(401).json({ message: "유효하지 않거나 폐기된 초대 링크입니다." });
    }
    request.applicantSession = { session, invitation, candidate, exam };
    return next();
  };
  const authenticateApplicantBeacon = (request, response, next) => {
    const accessToken = typeof request.body?.accessToken === "string" ? request.body.accessToken : "";
    if (accessToken && !request.header("authorization")) request.headers.authorization = "Bearer " + accessToken;
    return authenticateApplicant(request, response, next);
  };
  const recordMediaDisconnectWarnings = async (examinee, nextMediaStatus) => {
    const previousMediaStatus = examinee.mediaStatus ?? {};
    const disconnectedLabels = {
      webcam: "웹캠 연결이 끊겼습니다.", microphone: "마이크 연결이 끊겼습니다.", screen: "PC 화면 공유가 중단되었습니다.", auxiliaryCamera: "모바일 보조 카메라 연결이 끊겼습니다."
    };
    const firstStatusReport = !previousMediaStatus.updatedAt;
    for (const [key, disconnectedMessage] of Object.entries(disconnectedLabels)) {
      const initiallyMissingAuxiliary = firstStatusReport && key === "auxiliaryCamera" && !nextMediaStatus[key];
      const disconnected = previousMediaStatus[key] && !nextMediaStatus[key];
      if (!initiallyMissingAuxiliary && !disconnected) continue;
      const message = initiallyMissingAuxiliary ? "모바일 보조 카메라가 연결되지 않았습니다." : disconnectedMessage;
      const duplicateCutoff = Date.now() - 60_000;
      const recentlyRecorded = store.warnings.some((warning) => warning.examineeId === examinee.id && warning.source === "SYSTEM" && warning.message === message && Date.parse(warning.createdAt) >= duplicateCutoff);
      if (!recentlyRecorded) await store.addWarning({ id: randomUUID(), examineeId: examinee.id, examId: examinee.examId, organizationId: examinee.organizationId, message, source: "SYSTEM", createdAt: new Date().toISOString() });
    }
  };
  const disconnectApplicantMedia = async ({ candidate, exam, recordWarnings = true }) => {
    const updatedAt = new Date().toISOString();
    for (const [id, liveSession] of liveSessions) {
      if (liveSession.examId === exam.id && liveSession.candidateId === candidate.id) liveSessions.delete(id);
    }
    for (const device of auxiliaryDevices.values()) {
      if (device.examId !== exam.id || device.candidateId !== candidate.id) continue;
      device.deviceToken = null;
      await store.updateAuxiliaryDevice(device.token, { deviceToken: null });
    }
    const examinee = store.examinees.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
    if (examinee) {
      const disconnectedMediaStatus = { webcam: false, microphone: false, screen: false, auxiliaryCamera: false, updatedAt };
      if (recordWarnings) await recordMediaDisconnectWarnings(examinee, disconnectedMediaStatus);
      await store.updateExaminee(examinee.id, {
        mediaStatus: disconnectedMediaStatus,
        monitoringSnapshot: null,
        auxiliarySnapshot: null
      });
    }
  };
  const staleMediaStatusTimer = setInterval(() => {
    void (async () => {
      const cutoff = Date.now() - 30_000;
      for (const examinee of store.examinees) {
        const mediaStatus = examinee.mediaStatus ?? {};
        const updatedAt = Date.parse(mediaStatus.updatedAt ?? "");
        const hasActiveMedia = mediaStatus.webcam || mediaStatus.microphone || mediaStatus.screen || mediaStatus.auxiliaryCamera;
        if (!hasActiveMedia || Number.isNaN(updatedAt) || updatedAt > cutoff) continue;
        const disconnectedMediaStatus = { webcam: false, microphone: false, screen: false, auxiliaryCamera: false, updatedAt: new Date().toISOString() };
        await recordMediaDisconnectWarnings(examinee, disconnectedMediaStatus);
        await store.updateExaminee(examinee.id, { mediaStatus: disconnectedMediaStatus, monitoringSnapshot: null, auxiliarySnapshot: null });
      }
    })().catch((error) => console.error("Stale media status cleanup failed", error));
  }, 10_000);
  staleMediaStatusTimer.unref?.();
  app.post("/api/auth/logout", authenticate, async (request, response) => {
    const token = request.header("authorization")?.replace("Bearer ", "");
    if (token) {
      const tokenHash = hashToken(token);
      sessions.delete(tokenHash);
      await store.removeSession(tokenHash);
    }
    return response.sendStatus(204);
  });
  app.get("/api/applicant/session", authenticateApplicant, (request, response) => {
    const { invitation, candidate, exam } = request.applicantSession;
    return response.json({ exam: { id: exam.id, title: exam.title, duration: exam.duration, questions: exam.questions, date: exam.date }, candidate: { name: candidate.name, candidateNumber: candidate.candidateNumber }, expiresAt: invitation.expiresAt });
  });
  app.get("/api/applicant/notices", authenticateApplicant, (request, response) => {
    const { exam } = request.applicantSession;
    return response.json(store.notices
      .filter((notice) => {
        const scope = notice.scope ?? "GLOBAL";
        return scope === "GLOBAL"
          || (scope === "ORGANIZATION" && notice.organizationId === exam.organizationId)
          || (scope === "EXAM" && notice.examId === exam.id);
      })
      .filter((notice) => isPublishedNotice(notice))
      .sort(noticeSort)
      .map(publicNotice));
  });
  app.get("/api/applicant/warnings", authenticateApplicant, (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const { candidate, exam } = request.applicantSession;
    const examinee = store.examinees.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
    if (!examinee) return response.json([]);
    return response.json(store.warnings
      .filter((warning) => warning.examId === exam.id && warning.examineeId === examinee.id)
      .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
      .map(({ id, message, createdAt, source, type }) => ({ id, message, createdAt, source, type })));
  });
  app.get("/api/applicant/notices/:id", authenticateApplicant, async (request, response, next) => {
    try {
      const { exam } = request.applicantSession;
      const notice = store.notices.find((item) => item.id === request.params.id);
      const scope = notice?.scope ?? "GLOBAL";
      const canView = notice && (
        scope === "GLOBAL"
        || (scope === "ORGANIZATION" && notice.organizationId === exam.organizationId)
        || (scope === "EXAM" && notice.examId === exam.id)
      );
      if (!canView || !isPublishedNotice(notice)) return response.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      const updated = await store.updateNotice(notice.id, { viewCount: (notice.viewCount ?? 0) + 1 });
      return response.json(publicNotice(updated));
    } catch (error) {
      return next(error);
    }
  });
  app.put("/api/applicant/media-status", authenticateApplicant, async (request, response, next) => {
    try {
      const { candidate, exam } = request.applicantSession;
      const media = request.body.media && typeof request.body.media === "object" ? request.body.media : {};
      let examinee = store.examinees.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
      const mediaStatus = {
        webcam: Boolean(media.webcam),
        microphone: Boolean(media.microphone),
        screen: Boolean(media.screen),
        auxiliaryCamera: typeof media.auxiliaryCamera === "boolean" ? media.auxiliaryCamera : Boolean(examinee?.mediaStatus?.auxiliaryCamera),
        updatedAt: new Date().toISOString()
      };
      const disconnecting = !mediaStatus.webcam && !mediaStatus.screen && !mediaStatus.auxiliaryCamera;
      if (disconnecting) {
        await disconnectApplicantMedia({ candidate, exam });
        return response.json({ mediaStatus });
      }
      if (!examinee) {
        examinee = { id: randomUUID(), candidateId: candidate.id, name: candidate.name, organizationId: exam.organizationId, examId: exam.id, status: "NORMAL", statusText: "시험 입장 완료", currentProb: "시험 시작 전", mediaStatus };
        await store.addExaminee(examinee);
      } else {
        await recordMediaDisconnectWarnings(examinee, mediaStatus);
        await store.updateExaminee(examinee.id, { mediaStatus, ...(disconnecting ? { monitoringSnapshot: null } : {}) });
      }
      return response.json({ mediaStatus });
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/applicant/media-disconnect", authenticateApplicantBeacon, async (request, response, next) => {
    try {
      await disconnectApplicantMedia(request.applicantSession);
      return response.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });
  const idCardScanResponse = (scan) => ({
    status: scan.status,
    verified: scan.status === "VERIFIED",
    message: scan.message ?? ""
  });
  const submitIdCardScan = async (scan, image) => {
    if (!image.startsWith("data:image/") || image.length > 5_000_000) {
      const error = new Error("신분증 사진 형식이 올바르지 않거나 파일이 너무 큽니다.");
      error.status = 400;
      throw error;
    }
    const candidate = store.candidates.find((item) => item.id === scan.candidateId);
    if (!candidate?.birthDate) {
      const error = new Error("등록된 응시자 생년월일을 찾을 수 없습니다.");
      error.status = 409;
      throw error;
    }
    const ocrResult = await verifyIdCardWithOcr(image, candidate.name);
    const expected = candidate.birthDate.replace(/-/g, "").slice(-6);
    const birthDateMatched = ocrResult.residentNumberFront === expected;
    const verified = birthDateMatched && ocrResult.nameMatched;
    const updated = await store.updateIdCardScan(scan.token, {
      status: verified ? "VERIFIED" : "MISMATCH",
      message: verified ? "등록된 이름과 생년월일이 일치합니다." : !ocrResult.nameMatched ? "신분증 이름이 등록된 응시자 정보와 일치하지 않습니다." : "신분증 생년월일이 등록된 응시자 정보와 일치하지 않습니다.",
      image: null,
      capturedAt: new Date().toISOString()
    });
    Object.assign(scan, updated);
    return idCardScanResponse(updated);
  };
  app.post("/api/applicant/id-card-scans", authenticateApplicant, async (request, response, next) => {
    try {
      const { candidate, exam } = request.applicantSession;
      const scan = { token: randomUUID(), examId: exam.id, candidateId: candidate.id, status: "PENDING", expiresAt: Date.now() + 60 * 60 * 1000 };
      idCardScans.set(scan.token, scan);
      await store.addIdCardScan(scan);
      return response.status(201).json({ token: scan.token });
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/applicant/id-card-scans/:token", authenticateApplicant, (request, response) => {
    const { candidate, exam } = request.applicantSession;
    const scan = idCardScans.get(request.params.token);
    if (!scan || scan.expiresAt <= Date.now() || scan.candidateId !== candidate.id || scan.examId !== exam.id) {
      return response.status(404).json({ message: "신분증 QR 촬영 요청을 찾을 수 없습니다." });
    }
    return response.json(idCardScanResponse(scan));
  });
  app.post("/api/applicant/id-card-scans/:token/capture", authenticateApplicant, async (request, response, next) => {
    try {
      const { candidate, exam } = request.applicantSession;
      const scan = idCardScans.get(request.params.token);
      if (!scan || scan.expiresAt <= Date.now() || scan.candidateId !== candidate.id || scan.examId !== exam.id) {
        return response.status(404).json({ message: "신분증 QR 촬영 요청을 찾을 수 없습니다." });
      }
      return response.json(await submitIdCardScan(scan, typeof request.body.image === "string" ? request.body.image : ""));
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/mobile-id-scans/:token/capture", async (request, response, next) => {
    try {
      const scan = idCardScans.get(request.params.token);
      if (!scan || scan.expiresAt <= Date.now()) return response.status(404).json({ message: "만료되었거나 올바르지 않은 신분증 QR 코드입니다." });
      return response.json(await submitIdCardScan(scan, typeof request.body.image === "string" ? request.body.image : ""));
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/mobile-id-scans/:token/detect", async (request, response, next) => {
    try {
      const scan = idCardScans.get(request.params.token);
      if (!scan || scan.expiresAt <= Date.now()) return response.status(404).json({ message: "만료되었거나 올바르지 않은 신분증 QR 코드입니다." });
      const image = typeof request.body.image === "string" ? request.body.image : "";
      return response.json(await detectIdCardWithOcr(image));
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/applicant/auxiliary-devices", authenticateApplicant, async (request, response, next) => {
    try {
      const { candidate, exam } = request.applicantSession;
      const token = randomUUID();
      const device = { token, examId: exam.id, candidateId: candidate.id, expiresAt: Date.now() + 60 * 60 * 1000 };
      auxiliaryDevices.set(token, device);
      await store.addAuxiliaryDevice(device);
      return response.status(201).json({ token });
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/applicant/auxiliary-devices/:token", authenticateApplicant, (request, response) => {
    const { candidate, exam } = request.applicantSession;
    const device = auxiliaryDevices.get(request.params.token);
    if (!device || device.examId !== exam.id || device.candidateId !== candidate.id || device.expiresAt <= Date.now()) return response.status(404).json({ message: "보조 카메라 연결 요청을 찾을 수 없습니다." });
    return response.json({ connected: Boolean(device.deviceToken) });
  });
  app.post("/api/mobile-devices/pair", async (request, response, next) => {
    try {
      const token = typeof request.body.token === "string" ? request.body.token : "";
      const device = auxiliaryDevices.get(token);
      if (!device || device.expiresAt <= Date.now()) return response.status(404).json({ message: "만료되었거나 올바르지 않은 보조 카메라 QR 코드입니다." });
      device.deviceToken ??= randomUUID();
      await store.updateAuxiliaryDevice(device.token, { deviceToken: device.deviceToken });
      const examinee = store.examinees.find((item) => item.examId === device.examId && item.candidateId === device.candidateId);
      if (examinee) await store.updateExaminee(examinee.id, { mediaStatus: { ...(examinee.mediaStatus ?? {}), auxiliaryCamera: true, updatedAt: new Date().toISOString() } });
      return response.json({ deviceToken: device.deviceToken });
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/mobile-devices/:deviceToken/status", (request, response) => {
    const device = [...auxiliaryDevices.values()].find((item) => item.deviceToken === request.params.deviceToken && item.expiresAt > Date.now());
    if (!device) return response.json({ ended: true });
    const assignment = store.assignments.find((item) => item.examId === device.examId && item.candidateId === device.candidateId);
    const invitation = store.invitations.find((item) => item.examId === device.examId && item.candidateId === device.candidateId);
    const examinee = store.examinees.find((item) => item.examId === device.examId && item.candidateId === device.candidateId);
    const pcMediaEnded = Boolean(examinee?.mediaStatus?.updatedAt) && !examinee.mediaStatus.webcam && !examinee.mediaStatus.screen;
    return response.json({ ended: assignment?.status === "SUBMITTED" || Boolean(invitation?.submittedAt) || pcMediaEnded });
  });
  app.get("/api/mobile-devices/:deviceToken/live-offers", (request, response) => {
    const device = [...auxiliaryDevices.values()].find((item) => item.deviceToken === request.params.deviceToken && item.expiresAt > Date.now());
    if (!device) return response.status(401).json({ message: "유효하지 않은 보조 카메라 연결입니다." });
    const session = [...liveSessions.values()].find((item) => item.source === "auxiliary" && item.examId === device.examId && item.candidateId === device.candidateId && !item.answer && Date.now() - item.createdAt < 30000);
    return response.json(session ? { id: session.id, offer: session.offer } : null);
  });
  app.post("/api/mobile-devices/:deviceToken/live-offers/:id/answer", (request, response) => {
    const device = [...auxiliaryDevices.values()].find((item) => item.deviceToken === request.params.deviceToken && item.expiresAt > Date.now());
    const session = liveSessions.get(request.params.id);
    if (!device || !session || session.source !== "auxiliary" || session.examId !== device.examId || session.candidateId !== device.candidateId || typeof request.body.answer?.sdp !== "string") return response.status(404).json({ message: "보조 카메라 라이브 연결 요청을 찾을 수 없습니다." });
    session.answer = request.body.answer;
    return response.sendStatus(204);
  });
  app.put("/api/mobile-devices/:deviceToken/snapshot", async (request, response, next) => {
    try {
      const device = [...auxiliaryDevices.values()].find((item) => item.deviceToken === request.params.deviceToken && item.expiresAt > Date.now());
      const image = typeof request.body.image === "string" ? request.body.image : "";
      if (!device || !image.startsWith("data:image/") || image.length > 120000) return response.status(400).json({ message: "보조 카메라 화면 형식이 올바르지 않습니다." });
      const examinee = store.examinees.find((item) => item.examId === device.examId && item.candidateId === device.candidateId);
      if (examinee) {
        const updatedAt = new Date().toISOString();
        await store.updateExaminee(examinee.id, {
          mediaStatus: { ...(examinee.mediaStatus ?? {}), auxiliaryCamera: true, updatedAt },
          auxiliarySnapshot: { image, updatedAt }
        });
      }
      return response.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/mobile-devices/:deviceToken/disconnect", async (request, response, next) => {
    try {
      const device = [...auxiliaryDevices.values()].find((item) => item.deviceToken === request.params.deviceToken);
      if (!device) return response.sendStatus(204);
      for (const [id, liveSession] of liveSessions) {
        if (liveSession.source === "auxiliary" && liveSession.examId === device.examId && liveSession.candidateId === device.candidateId) liveSessions.delete(id);
      }
      const examinee = store.examinees.find((item) => item.examId === device.examId && item.candidateId === device.candidateId);
      if (examinee) {
        const mediaStatus = { ...(examinee.mediaStatus ?? {}), auxiliaryCamera: false, updatedAt: new Date().toISOString() };
        await recordMediaDisconnectWarnings(examinee, mediaStatus);
        await store.updateExaminee(examinee.id, {
          mediaStatus,
          auxiliarySnapshot: null
        });
      }
      device.deviceToken = null;
      await store.updateAuxiliaryDevice(device.token, { deviceToken: null });
      return response.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });
  app.put("/api/applicant/monitoring-snapshot", authenticateApplicant, async (request, response, next) => {
    try {
      const { candidate, exam } = request.applicantSession;
      const image = typeof request.body.image === "string" ? request.body.image : "";
      if (!image.startsWith("data:image/") || image.length > 120000) return response.status(400).json({ message: "모니터링 화면 형식이 올바르지 않습니다." });
      let examinee = store.examinees.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
      if (!examinee) {
        examinee = { id: randomUUID(), candidateId: candidate.id, name: candidate.name, organizationId: exam.organizationId, examId: exam.id, status: "NORMAL", statusText: "시험 입장 완료", currentProb: "시험 시작 전" };
        await store.addExaminee(examinee);
      }
      const snapshotUpdatedAt = new Date().toISOString();
      const previousAi = examinee.monitoringSnapshot?.ai;
      await store.updateExaminee(examinee.id, { monitoringSnapshot: { image, updatedAt: snapshotUpdatedAt, ...(previousAi ? { ai: previousAi } : {}) } });
      aiProctor.schedule({ image, examineeId: examinee.id, examId: exam.id, candidateId: candidate.id, snapshotUpdatedAt });
      return response.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/applicant/live-offers", authenticateApplicant, (request, response) => {
    const { candidate, exam } = request.applicantSession;
    const session = [...liveSessions.values()].find((item) => item.source === "candidate" && item.examId === exam.id && item.candidateId === candidate.id && !item.answer && Date.now() - item.createdAt < 30000);
    return response.json(session ? { id: session.id, offer: session.offer } : null);
  });
  app.post("/api/applicant/live-offers/:id/answer", authenticateApplicant, (request, response) => {
    const { candidate, exam } = request.applicantSession;
    const session = liveSessions.get(request.params.id);
    if (!session || session.source !== "candidate" || session.examId !== exam.id || session.candidateId !== candidate.id || typeof request.body.answer?.sdp !== "string") return response.status(404).json({ message: "라이브 연결 요청을 찾을 수 없습니다." });
    session.answer = request.body.answer;
    return response.sendStatus(204);
  });
  app.get("/api/applicant/exam", authenticateApplicant, (request, response) => {
    const { exam } = request.applicantSession;
    const questions = store.questions.filter((question) => question.examId === exam.id).map(publicQuestion);
    return response.json({ exam: { id: exam.id, title: exam.title, duration: exam.duration, questions: exam.questions, date: exam.date }, questions });
  });
  app.post("/api/applicant/exam/run", authenticateApplicant, async (request, response, next) => {
    let releaseExecutionSlot;
    try {
      const { exam, invitation } = request.applicantSession;
      const questionId = typeof request.body.questionId === "string" ? request.body.questionId : "";
      const language = typeof request.body.language === "string" ? request.body.language : "";
      const source = typeof request.body.source === "string" ? request.body.source.trim() : "";
      const stdin = typeof request.body.stdin === "string" ? request.body.stdin.slice(0, 20_000) : "";
      const question = store.questions.find((item) => item.id === questionId && item.examId === exam.id && item.type === "CODING");
      const allowedLanguages = new Set(question?.languages?.length ? question.languages : ["Python", "JavaScript"]);
      if (invitation.submittedAt) return response.status(409).json({ message: "이미 제출한 시험에서는 코드를 실행할 수 없습니다." });
      if (!question) return response.status(404).json({ message: "실행할 코딩 문제를 찾을 수 없습니다." });
      if (!allowedLanguages.has(language) || !executionLanguageIds[language]) return response.status(400).json({ message: "이 문제에서 지원하지 않는 실행 언어입니다." });
      if (!source) return response.status(400).json({ message: "실행할 코드를 입력해 주세요." });
      if (source.length > 100_000) return response.status(413).json({ message: "코드가 너무 깁니다. 100,000자 이하로 입력해 주세요." });
      if (codeExecutionConfigError) return response.status(503).json({ message: codeExecutionConfigError });
      if (!normalizedCodeExecutionUrl) return response.status(503).json({ message: "코드 실행 서버가 설정되지 않았습니다. CODE_EXECUTION_API_URL을 등록해 주세요." });
      releaseExecutionSlot = acquireExecutionSlot(`${invitation.id}:${request.ip}`);
      const result = await executeCode({ baseUrl: normalizedCodeExecutionUrl, language, source, stdin });
      return response.json({ ...result, language, executedAt: new Date().toISOString() });
    } catch (error) {
      return next(error);
    } finally {
      releaseExecutionSlot?.();
    }
  });
  app.get("/api/applicant/exam/progress", authenticateApplicant, (request, response) => {
    const { candidate, exam } = request.applicantSession;
    const submission = store.codingSubmissions.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
    return response.json({ answers: submission?.answers ?? {}, runResults: submission?.runResults ?? {}, updatedAt: submission?.updatedAt ?? null, status: submission?.status ?? "DRAFT" });
  });
  app.put("/api/applicant/exam/progress", authenticateApplicant, async (request, response, next) => {
    try {
      const { invitation, candidate, exam } = request.applicantSession;
      if (invitation.submittedAt) return response.status(409).json({ message: "이미 제출한 시험의 답안은 수정할 수 없습니다." });
      const questions = store.questions.filter((question) => question.examId === exam.id);
      const answers = request.body.answers && typeof request.body.answers === "object" ? request.body.answers : {};
      const runResults = request.body.runResults && typeof request.body.runResults === "object" ? request.body.runResults : {};
      const now = new Date().toISOString();
      const submission = await store.saveCodingSubmission({
        id: store.codingSubmissions.find((item) => item.examId === exam.id && item.candidateId === candidate.id)?.id ?? randomUUID(),
        examId: exam.id,
        organizationId: exam.organizationId,
        candidateId: candidate.id,
        answers: normalizeCodingAnswers(answers, questions),
        runResults: normalizeRunResults(runResults, questions),
        status: "DRAFT",
        submittedAt: null,
        updatedAt: now
      });
      return response.json({ updatedAt: submission.updatedAt, status: submission.status });
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/applicant/exam/submit", authenticateApplicant, async (request, response, next) => {
    try {
      const { invitation, candidate, exam } = request.applicantSession;
      const answers = request.body.answers && typeof request.body.answers === "object" ? request.body.answers : {};
      const questions = store.questions.filter((question) => question.examId === exam.id);
      if (questions.length === 0) return response.status(409).json({ message: "시험 문제가 아직 등록되지 않았습니다." });
      if (invitation.submittedAt) return response.status(409).json({ message: "이 시험은 이미 제출되었습니다." });
      const codingQuestions = questions.filter((question) => question.type === "CODING");
      const now = new Date().toISOString();
      if (codingQuestions.length) {
        const runResults = request.body.runResults && typeof request.body.runResults === "object" ? request.body.runResults : {};
        const existingSubmission = store.codingSubmissions.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
        await store.saveCodingSubmission({
          id: existingSubmission?.id ?? randomUUID(),
          examId: exam.id,
          organizationId: exam.organizationId,
          candidateId: candidate.id,
          answers: normalizeCodingAnswers(answers, questions),
          runResults: normalizeRunResults(runResults, questions),
          status: "SUBMITTED",
          submittedAt: now,
          updatedAt: now
        });
      }
      const correctCount = questions.filter((question) => question.type !== "CODING" && answers[question.id] === question.answer).length;
      const score = codingQuestions.length ? null : Math.round((correctCount / questions.length) * 100);
      const assignment = store.assignments.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
      if (assignment) await store.updateAssignment(assignment.id, { status: "SUBMITTED", score, resultStatus: codingQuestions.length ? "PENDING_REVIEW" : "SUBMITTED", submittedAt: now });
      await store.updateInvitation(invitation.id, { submittedAt: now });
      const examinee = store.examinees.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
      await disconnectApplicantMedia({ candidate, exam, recordWarnings: false });
      if (examinee) {
        await store.updateExaminee(examinee.id, {
          status: "SUBMITTED",
          statusText: "제출 완료",
          currentProb: "제출 완료"
        });
      }
      return response.json({ examId: exam.id, score, correctCount, totalCount: questions.length, status: "SUBMITTED", gradingStatus: codingQuestions.length ? "PENDING_REVIEW" : "COMPLETED" });
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/admin/users", authenticate, requireRole("ADMIN"), (_request, response) => {
    response.json(store.users.filter((user) => isManagerRole(user.role)).map(publicUser));
  });
  app.get("/api/admin/notices", authenticate, requireRole("ADMIN"), (_request, response) =>
    response.json([...store.notices].sort(noticeSort).map(publicNotice)));
  app.post("/api/admin/notices", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const input = normalizeNoticeInput(request.body);
      if (!input.title || !input.content) return response.status(400).json({ message: "공지 제목과 내용을 입력해주세요." });
      if (input.publishStartAt === undefined || input.publishEndAt === undefined) return response.status(400).json({ message: "게시 기간을 올바르게 입력해주세요." });
      if (input.publishStartAt && input.publishEndAt && new Date(input.publishStartAt) > new Date(input.publishEndAt)) return response.status(400).json({ message: "게시 종료일은 시작일 이후여야 합니다." });
      const now = new Date().toISOString();
      const notice = await store.addNotice({ id: randomUUID(), ...input, scope: "GLOBAL", organizationId: null, examId: null, publishedAt: input.publishStartAt ?? now, viewCount: 0, authorId: request.user.id, createdAt: now, updatedAt: now });
      return response.status(201).json(publicNotice(notice));
    } catch (error) {
      return next(error);
    }
  });
  app.patch("/api/admin/notices/:id", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const existing = store.notices.find((item) => item.id === request.params.id);
      if (!existing) return response.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      const input = normalizeNoticeInput({ ...existing, ...request.body });
      if (!input.title || !input.content) return response.status(400).json({ message: "공지 제목과 내용을 입력해주세요." });
      if (input.publishStartAt === undefined || input.publishEndAt === undefined) return response.status(400).json({ message: "게시 기간을 올바르게 입력해주세요." });
      if (input.publishStartAt && input.publishEndAt && new Date(input.publishStartAt) > new Date(input.publishEndAt)) return response.status(400).json({ message: "게시 종료일은 시작일 이후여야 합니다." });
      const notice = await store.updateNotice(existing.id, { ...input, publishedAt: input.publishStartAt ?? existing.publishedAt ?? existing.date ?? new Date().toISOString(), updatedAt: new Date().toISOString() });
      return response.json(publicNotice(notice));
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/admin/notices/:id", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const removed = await store.removeNotice(request.params.id);
      if (!removed) return response.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });
  const publicCommunityComment = (comment) => ({
    ...comment,
    authorName: store.users.find((user) => user.id === comment.authorId)?.name ?? "사용자"
  });
  const publicCommunityPost = (post, includeComments = false) => ({
    ...post,
    authorName: store.users.find((user) => user.id === post.authorId)?.name ?? "사용자",
    organizationName: store.organizations.find((item) => item.id === post.organizationId)?.name ?? null,
    examTitle: post.examId ? store.exams.find((item) => item.id === post.examId)?.title ?? null : null,
    commentCount: store.communityComments.filter((item) => item.postId === post.id).length,
    ...(includeComments ? { comments: store.communityComments.filter((item) => item.postId === post.id).map(publicCommunityComment) } : {})
  });
  app.get("/api/admin/community", authenticate, requireRole("ADMIN"), (_request, response) =>
    response.json(store.communityPosts.map((post) => publicCommunityPost(post))));
  app.delete("/api/admin/community/:id", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const removed = await store.removeCommunityPost(request.params.id);
      return removed ? response.status(204).end() : response.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    } catch (error) {
      return next(error);
    }
  });
  app.patch("/api/admin/users/:id/status", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const { status } = request.body;
      if (!["APPROVED", "REJECTED", "SUSPENDED"].includes(status)) return response.status(400).json({ message: "관리자 계정 상태가 올바르지 않습니다." });
      const user = store.users.find((candidate) => candidate.id === request.params.id && isManagerRole(candidate.role));
      if (!user) return response.status(404).json({ message: "관리자 계정을 찾을 수 없습니다." });
      return response.json(publicUser(await store.updateUser(user.id, { approvalStatus: status })));
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/admin/overview", authenticate, requireRole("ADMIN"), (_request, response) => response.json({
    organizations: store.organizations.length,
    pendingOrganizations: store.organizations.filter((organization) => organization.status === "PENDING").length,
    managers: store.users.filter((user) => isManagerRole(user.role)).length,
    candidates: store.candidates.length,
    exams: store.exams.length,
    invitations: store.invitations.length
  }));
  app.get("/api/admin/policies", authenticate, requireRole("ADMIN"), (_request, response) => response.json(store.systemPolicies));
  app.patch("/api/admin/policies", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const aiAnalysisEnabled = request.body.aiAnalysisEnabled;
      const cheatDetection = request.body.cheatDetection;
      const invitationSecurity = request.body.invitationSecurity;
      const validCheatDetection = cheatDetection === undefined || (cheatDetection && typeof cheatDetection.gazeWarningEnabled === "boolean" && typeof cheatDetection.audioDetectionEnabled === "boolean" && typeof cheatDetection.tabSwitchSubmitEnabled === "boolean");
      const validInvitationSecurity = invitationSecurity === undefined || (invitationSecurity && Number.isInteger(invitationSecurity.maxVerificationAttempts) && invitationSecurity.maxVerificationAttempts >= 1 && invitationSecurity.maxVerificationAttempts <= 10 && Number.isInteger(invitationSecurity.verificationLockoutMinutes) && invitationSecurity.verificationLockoutMinutes >= 1 && invitationSecurity.verificationLockoutMinutes <= 1440 && Number.isInteger(invitationSecurity.applicantSessionMinutes) && invitationSecurity.applicantSessionMinutes >= 30 && invitationSecurity.applicantSessionMinutes <= 480 && Number.isInteger(invitationSecurity.reverificationCooldownMinutes) && invitationSecurity.reverificationCooldownMinutes >= 0 && invitationSecurity.reverificationCooldownMinutes <= 1440);
      if (typeof aiAnalysisEnabled !== "boolean" || !validCheatDetection || !validInvitationSecurity) return response.status(400).json({ message: "정책 값을 확인해주세요." });
      const previous = { invitationSecurity: store.systemPolicies.invitationSecurity };
      const updated = await store.updateSystemPolicies({ aiAnalysisEnabled, ...(cheatDetection === undefined ? {} : { cheatDetection }), ...(invitationSecurity === undefined ? {} : { invitationSecurity }) });
      await addInvitationAudit("POLICY_UPDATED", request.user, { previous, next: { invitationSecurity: updated.invitationSecurity } });
      return response.json(updated);
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/admin/invitations/overview", authenticate, requireRole("ADMIN"), (_request, response) => {
    const now = new Date();
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const invitations = store.invitations.map(publicAdminInvitation);
    const sentToday = invitations.filter((item) => item.sentAt && new Date(item.sentAt).toDateString() === now.toDateString()).length;
    const expiringSoon = invitations.filter((item) => item.status === "ACTIVE" && new Date(item.expiresAt) <= nextDay).length;
    const deliveryFailures = invitations.filter((item) => item.deliveryStatus === "FAILED").length;
    const organizationStats = store.organizations.map((organization) => {
      const rows = invitations.filter((item) => item.organizationId === organization.id);
      return { organizationId: organization.id, organizationName: organization.name, invitationCount: rows.length, activeCount: rows.filter((item) => item.status === "ACTIVE").length, verifiedCount: rows.filter((item) => item.verifiedAt).length, unverifiedCount: rows.filter((item) => item.status === "ACTIVE" && !item.verifiedAt).length };
    });
    return response.json({ metrics: { active: invitations.filter((item) => item.status === "ACTIVE").length, sentToday, expiringSoon, deliveryFailures }, warnings: invitations.filter((item) => item.deliveryStatus === "FAILED" || (item.status === "ACTIVE" && new Date(item.expiresAt) <= nextDay)).slice(0, 20), organizationStats, filterOptions: { organizations: store.organizations.map((item) => ({ id: item.id, name: item.name })), exams: store.exams.map((item) => ({ id: item.id, title: item.title, organizationId: item.organizationId })) } });
  });
  app.get("/api/admin/invitations", authenticate, requireRole("ADMIN"), (request, response) => {
    const status = typeof request.query.status === "string" ? request.query.status : "";
    const organizationId = typeof request.query.organizationId === "string" ? request.query.organizationId : "";
    const examId = typeof request.query.examId === "string" ? request.query.examId : "";
    const sentFrom = typeof request.query.sentFrom === "string" ? new Date(request.query.sentFrom) : undefined;
    const sentTo = typeof request.query.sentTo === "string" ? new Date(`${request.query.sentTo}T23:59:59.999Z`) : undefined;
    const query = typeof request.query.query === "string" ? request.query.query.trim().toLowerCase() : "";
    const expiringSoon = request.query.expiringSoon === "true";
    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const rows = store.invitations.map(publicAdminInvitation).filter((item) => (!status || item.status === status) && (!organizationId || item.organizationId === organizationId) && (!examId || item.examId === examId) && (!sentFrom || Number.isNaN(sentFrom.getTime()) || new Date(item.sentAt) >= sentFrom) && (!sentTo || Number.isNaN(sentTo.getTime()) || new Date(item.sentAt) <= sentTo) && (!expiringSoon || (item.status === "ACTIVE" && new Date(item.expiresAt) <= cutoff)) && (!query || [item.organizationName, item.examTitle, item.candidateName, item.candidateEmail].some((value) => value.toLowerCase().includes(query))));
    return response.json(rows);
  });
  app.get("/api/admin/invitation-audit-logs", authenticate, requireRole("ADMIN"), (_request, response) => response.json(store.invitationAuditLogs.slice(0, 100)));
  app.post("/api/admin/invitations/:id/revoke", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const reason = typeof request.body.reason === "string" ? request.body.reason.trim().slice(0, 500) : "";
      const invitation = store.invitations.find((item) => item.id === request.params.id);
      if (!reason) return response.status(400).json({ message: "폐기 사유를 입력해주세요." });
      if (!invitation) return response.status(404).json({ message: "초대 링크를 찾을 수 없습니다." });
      if (invitationStatus(invitation) !== "ACTIVE") return response.status(409).json({ message: "활성 상태의 링크만 폐기할 수 있습니다." });
      const revokedAt = new Date().toISOString();
      const updated = await store.updateInvitation(invitation.id, { revokedAt, revokedReason: reason, revokedBy: request.user.id });
      await addInvitationAudit("INVITATION_REVOKED", request.user, { invitationId: invitation.id, organizationId: invitation.organizationId, examId: invitation.examId, candidateId: invitation.candidateId, reason });
      return response.json(publicAdminInvitation(updated));
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/admin/ai-settings", authenticate, requireRole("ADMIN"), (_request, response) => response.json(publicAiSettings()));
  app.post("/api/admin/ai-settings/verify-key", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const provider = typeof request.body.provider === "string" ? request.body.provider.trim() : "";
      const apiKey = typeof request.body.apiKey === "string" ? request.body.apiKey.trim() : "";
      if (!aiProviderModels[provider] || !apiKey) return response.status(400).json({ message: "AI 제공자와 API 키를 입력하세요." });
      return response.json(await verifyAiApiKey({ provider, apiKey }));
    } catch (error) {
      return next(error);
    }
  });
  app.patch("/api/admin/ai-settings", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const provider = typeof request.body.provider === "string" ? request.body.provider.trim() : "";
      const model = typeof request.body.model === "string" ? request.body.model.trim() : "";
      const apiKey = typeof request.body.apiKey === "string" ? request.body.apiKey.trim() : "";
      // Legacy policy data is retained only to render historical usage gauges; it is no
      // longer editable nor used to authorize an organization's direct API access.
      const policies = Array.isArray(request.body.organizations) ? request.body.organizations : organizationAiSettings();
      const organizationIds = new Set(store.organizations.map((organization) => organization.id));
      const validPolicies = Array.isArray(policies)
        && policies.length === organizationIds.size
        && new Set(policies.map((policy) => policy?.organizationId)).size === organizationIds.size
        && policies.every((policy) => organizationIds.has(policy?.organizationId) && typeof policy.enabled === "boolean" && Number.isSafeInteger(policy.monthlyLimit) && policy.monthlyLimit >= 0);
      if (!aiProviderModels[provider]?.has(model) || !validPolicies) return response.status(400).json({ message: "AI 제공자, 모델, 조직별 사용 권한과 월간 한도를 확인해주세요." });
      if (apiKey && !aiSettingsEncryptionKey) return response.status(503).json({ message: "API 키 암호화 환경변수(AI_SETTINGS_ENCRYPTION_KEY)가 설정되지 않았습니다." });
      const usageMonth = currentUsageMonth();
      const nextPolicies = Object.fromEntries(policies.map((policy) => {
        const current = store.organizationAiPolicies[policy.organizationId];
        return [policy.organizationId, {
          enabled: policy.enabled,
          monthlyLimit: policy.monthlyLimit,
          monthlyUsage: current?.usageMonth === usageMonth && Number.isSafeInteger(current.monthlyUsage) ? current.monthlyUsage : 0,
          usageMonth
        }];
      }));
      await store.updateSystemPolicies({ aiProvider: provider, aiModel: model, ...(apiKey ? { aiEncryptedApiKey: encryptAiApiKey(apiKey) } : {}) });
      await store.updateOrganizationAiPolicies(nextPolicies);
      return response.json(publicAiSettings());
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/admin/ai-grading-requests", authenticate, requireRole("ADMIN"), (_request, response) => response.json(store.aiGradingRequests.map(publicAiGradingRequest)));
  app.post("/api/admin/ai-grading-requests/:id/accept", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const gradingRequest = store.aiGradingRequests.find((item) => item.id === request.params.id);
      if (!gradingRequest) return response.status(404).json({ message: "AI 채점 요청을 찾을 수 없습니다." });
      if (gradingRequest.status !== "PENDING") return response.status(409).json({ message: "이미 처리 중이거나 완료된 요청입니다." });
      const processing = await store.updateAiGradingRequest(gradingRequest.id, { status: "PROCESSING", acceptedAt: new Date().toISOString(), acceptedBy: request.user.id });
      void executeAiGrading(processing).catch(async (error) => store.updateAiGradingRequest(processing.id, { status: "FAILED", failedAt: new Date().toISOString(), errorMessage: error.message }));
      return response.status(202).json(publicAiGradingRequest(processing));
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/admin/organizations", authenticate, requireRole("ADMIN"), (_request, response) => response.json(store.organizations.map((organization) => publicOrganization(organization, store.users))));
  app.get("/api/admin/candidates", authenticate, requireRole("ADMIN"), (_request, response) => response.json(store.candidates.map((candidate) => ({
    ...candidate,
    approvalStatus: "APPROVED",
    organizationName: store.organizations.find((organization) => organization.id === candidate.organizationId)?.name ?? "미배정",
    assignments: store.assignments.filter((assignment) => assignment.candidateId === candidate.id).map((assignment) => ({
      ...assignment,
      examTitle: store.exams.find((exam) => exam.id === assignment.examId)?.title ?? "시험",
      score: assignment.score ?? null,
      resultStatus: assignment.resultStatus ?? "NOT_STARTED"
    }))
  }))));
  app.get("/api/admin/exams", authenticate, requireRole("ADMIN"), (_request, response) => response.json(store.exams.map((exam) => ({
    ...exam,
    organizationName: store.organizations.find((organization) => organization.id === exam.organizationId)?.name ?? "조직 미배정",
    questionCount: store.questions.filter((question) => question.examId === exam.id).length
  }))));
  app.post("/api/admin/exams", authenticate, requireRole("ADMIN"), (_request, response) => response.status(403).json({ message: "시험 생성은 조직에 배정된 관리자의 권한입니다." }));
  app.post("/api/admin/managers", authenticate, requireRole("ADMIN"), async (request, response, next) => {
    try {
      const { name, email, password } = request.body;
      if (![name, email, password].every(isNonEmptyText)) return response.status(400).json({ message: "관리자 이름, 이메일, 비밀번호를 입력해주세요." });
      if (password.trim().length < 8) return response.status(400).json({ message: "비밀번호는 8자 이상 입력해주세요." });
      const normalizedEmail = email.trim().toLowerCase();
      if (store.users.some((user) => user.email === normalizedEmail)) return response.status(409).json({ message: "이미 등록된 이메일입니다." });
      const user = { id: randomUUID(), name: name.trim(), email: normalizedEmail, password, role: "MANAGER", approvalStatus: "APPROVED", organizationIds: [] };
      await store.addUser(user);
      return response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  });
  const updateOrganizationStatus = async (request, response, next) => {
    try {
      const { status } = request.body;
      if (!["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(status)) return response.status(400).json({ message: "조직 상태가 올바르지 않습니다." });
      const currentOrganization = store.organizations.find((candidate) => candidate.id === request.params.id);
      if (!currentOrganization) return response.status(404).json({ message: "조직을 찾을 수 없습니다." });
      const requester = store.users.find((user) => user.id === currentOrganization.requestedBy && isManagerRole(user.role));
      const managerIds = status === "APPROVED" && requester ? [...new Set([...(currentOrganization.managerIds ?? []), requester.id])] : currentOrganization.managerIds;
      const organization = await store.updateOrganization(request.params.id, { status, managerIds });
      if (!organization) return response.status(404).json({ message: "조직을 찾을 수 없습니다." });
      if (status === "APPROVED" && requester) await store.updateUser(requester.id, { organizationIds: [...new Set([...(requester.organizationIds ?? []), organization.id])] });
      return response.json(publicOrganization(organization, store.users));
    } catch (error) {
      return next(error);
    }
  };
  app.patch("/api/admin/organizations/:id", authenticate, requireRole("ADMIN"), updateOrganizationStatus);
  app.post("/api/admin/organizations/:id/approve", authenticate, requireRole("ADMIN"), (request, response, next) => updateOrganizationStatus({ ...request, body: { status: "APPROVED" } }, response, next));
  app.post("/api/admin/organizations/:id/reject", authenticate, requireRole("ADMIN"), (request, response, next) => updateOrganizationStatus({ ...request, body: { status: "REJECTED" } }, response, next));
  app.post("/api/admin/organizations/:id/assign-manager", authenticate, requireRole("ADMIN"), (request, response) => {
    return response.status(410).json({ message: "조직 관리자는 조직 승인 신청자 또는 기존 조직 관리자의 참여 승인으로 등록됩니다." });
  });
  app.get("/api/manager/overview", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const candidates = store.candidates.filter((candidate) => organizationIds.includes(candidate.organizationId));
    const exams = store.exams.filter((exam) => organizationIds.includes(exam.organizationId));
    response.json({ organizations: organizationIds.length, candidates: candidates.length, exams: exams.length, invitations: store.invitations.filter((invitation) => organizationIds.includes(invitation.organizationId)).length });
  });
  app.get("/api/manager/organizations", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    response.json(store.organizations.filter((organization) => organizationIds.includes(organization.id) || organization.requestedBy === request.user.id).map((organization) => ({ ...publicOrganization(organization, store.users), canManage: organizationIds.includes(organization.id) })));
  });
  const organizationJoinRequestView = (joinRequest) => {
    const organization = store.organizations.find((candidate) => candidate.id === joinRequest.organizationId);
    const requester = store.users.find((candidate) => candidate.id === joinRequest.requesterId);
    return {
      ...joinRequest,
      organizationName: organization?.name ?? "조직",
      organizationCode: organization?.code ?? "",
      requesterName: requester?.name ?? "관리자",
      requesterEmail: requester?.email ?? ""
    };
  };
  app.get("/api/manager/organization-join-requests", authenticate, requireManager, (request, response) => {
    const managedOrganizationIds = managerOrganizationIds(request.user, store.organizations);
    return response.json(store.organizationJoinRequests
      .filter((joinRequest) => managedOrganizationIds.includes(joinRequest.organizationId) || joinRequest.requesterId === request.user.id)
      .map((joinRequest) => ({ ...organizationJoinRequestView(joinRequest), canApprove: managedOrganizationIds.includes(joinRequest.organizationId) })));
  });
  app.post("/api/manager/organizations/join", authenticate, requireManager, async (request, response, next) => {
    try {
      const code = typeof request.body.code === "string" ? request.body.code.trim().toUpperCase() : "";
      const organization = store.organizations.find((candidate) => candidate.code === code && candidate.status === "APPROVED");
      if (!organization) return response.status(404).json({ message: "승인된 조직 코드를 찾을 수 없습니다." });
      if (organization.managerIds?.includes(request.user.id)) return response.status(409).json({ message: "이미 참여 중인 조직입니다." });
      const existingRequest = store.organizationJoinRequests.find((candidate) => candidate.organizationId === organization.id && candidate.requesterId === request.user.id && candidate.status === "PENDING");
      if (existingRequest) return response.status(409).json({ message: "이미 참여 신청을 보냈습니다." });
      const joinRequest = { id: randomUUID(), organizationId: organization.id, requesterId: request.user.id, status: "PENDING", createdAt: new Date().toISOString() };
      await store.addOrganizationJoinRequest(joinRequest);
      return response.status(201).json(organizationJoinRequestView(joinRequest));
    } catch (error) {
      return next(error);
    }
  });
  const reviewOrganizationJoinRequest = async (request, response, next, status) => {
    try {
      const joinRequest = store.organizationJoinRequests.find((candidate) => candidate.id === request.params.id && candidate.status === "PENDING");
      const managedOrganizationIds = managerOrganizationIds(request.user, store.organizations);
      if (!joinRequest || !managedOrganizationIds.includes(joinRequest.organizationId)) return response.status(403).json({ message: "해당 조직의 참여 신청을 승인할 권한이 없습니다." });
      if (status === "REJECTED") {
        await store.updateOrganizationJoinRequest(joinRequest.id, { status, reviewedBy: request.user.id, reviewedAt: new Date().toISOString() });
        return response.json(organizationJoinRequestView({ ...joinRequest, status }));
      }
      const organization = store.organizations.find((candidate) => candidate.id === joinRequest.organizationId);
      const user = store.users.find((candidate) => candidate.id === joinRequest.requesterId && isManagerRole(candidate.role));
      if (!organization || !user) return response.status(404).json({ message: "조직 또는 관리자 계정을 찾을 수 없습니다." });
      const managerIds = [...new Set([...(organization.managerIds ?? []), user.id])];
      const organizationIds = [...new Set([...(user.organizationIds ?? []), organization.id])];
      await store.updateOrganization(organization.id, { managerIds });
      await store.updateUser(user.id, { organizationIds });
      await store.updateOrganizationJoinRequest(joinRequest.id, { status, reviewedBy: request.user.id, reviewedAt: new Date().toISOString() });
      return response.json(organizationJoinRequestView({ ...joinRequest, status }));
    } catch (error) {
      return next(error);
    }
  };
  app.post("/api/manager/organization-join-requests/:id/approve", authenticate, requireManager, (request, response, next) => reviewOrganizationJoinRequest(request, response, next, "APPROVED"));
  app.post("/api/manager/organization-join-requests/:id/reject", authenticate, requireManager, (request, response, next) => reviewOrganizationJoinRequest(request, response, next, "REJECTED"));
  app.post("/api/manager/organizations", authenticate, requireManager, async (request, response, next) => {
    try {
      const { name, code } = request.body;
      if (!isNonEmptyText(name)) return response.status(400).json({ message: "조직명을 입력해주세요." });
      const normalizedCode = isNonEmptyText(code) ? code.trim().toUpperCase() : `ORG-${randomInt(100000, 1000000)}`;
      if (store.organizations.some((candidate) => candidate.code === normalizedCode)) return response.status(409).json({ message: "이미 사용 중인 조직 코드입니다." });
      const organization = { id: randomUUID(), name: name.trim(), code: normalizedCode, status: "PENDING", requestedBy: request.user.id, managerIds: [], createdAt: new Date().toISOString() };
      await store.addOrganization(organization);
      return response.status(201).json(publicOrganization(organization, store.users));
    } catch (error) {
      return next(error);
    }
  });
  // Organization managers can only request grading for an assignment in an organization they manage.
  app.get("/api/manager/ai-grading-requests", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const requestedOrganizationId = typeof request.query.organizationId === "string" ? request.query.organizationId : "";
    const examId = typeof request.query.examId === "string" ? request.query.examId : "";
    if (requestedOrganizationId && !organizationIds.includes(requestedOrganizationId)) return response.status(403).json({ message: "배정된 승인 조직의 AI 분석 요청만 조회할 수 있습니다." });
    const requests = store.aiGradingRequests.filter((item) =>
      organizationIds.includes(item.organizationId)
      && (!requestedOrganizationId || item.organizationId === requestedOrganizationId)
      && (!examId || item.examId === examId)
    );
    return response.json(requests.map(publicAiGradingRequest));
  });
  app.post("/api/manager/ai-grading-requests", authenticate, requireManager, async (request, response, next) => {
    try {
      const examId = typeof request.body.examId === "string" ? request.body.examId : "";
      const candidateId = typeof request.body.candidateId === "string" ? request.body.candidateId : "";
      const exam = store.exams.find((item) => item.id === examId);
      const candidate = store.candidates.find((item) => item.id === candidateId);
      const canManage = exam && candidate && exam.organizationId === candidate.organizationId && managerOrganizationIds(request.user, store.organizations).includes(exam.organizationId);
      if (!canManage || !store.assignments.some((item) => item.examId === examId && item.candidateId === candidateId)) return response.status(403).json({ message: "해당 응시자의 AI 채점 요청 권한이 없습니다." });
      if (store.aiGradingRequests.some((item) => item.examId === examId && item.candidateId === candidateId && ["PENDING", "PROCESSING"].includes(item.status))) return response.status(409).json({ message: "이미 처리 대기 중인 AI 채점 요청입니다." });
      const gradingRequest = { id: randomUUID(), organizationId: exam.organizationId, examId, candidateId, requestedBy: request.user.id, requestedAt: new Date().toISOString(), status: "PENDING" };
      await store.addAiGradingRequest(gradingRequest);
      return response.status(201).json(publicAiGradingRequest(gradingRequest));
    } catch (error) {
      return next(error);
    }
  });
  const scopedOrganization = (request, organizationId) => managerOrganizationIds(request.user, store.organizations).includes(organizationId) && store.organizations.find((organization) => organization.id === organizationId)?.status === "APPROVED";
  app.get("/api/manager/candidates", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    response.json(store.candidates.filter((candidate) => organizationIds.includes(candidate.organizationId)));
  });
  const createCandidate = async (request, organizationId, candidateInput) => {
    if (!scopedOrganization(request, organizationId)) return { error: { status: 403, message: "배정된 승인 조직만 관리할 수 있습니다." } };
    const { name, email, birthDate } = candidateInput;
    if (![name, email, birthDate].every(isNonEmptyText) || !isValidBirthDate(birthDate)) return { error: { status: 400, message: "응시자 이름, 이메일, 올바른 생년월일을 입력해주세요." } };
    const normalizedEmail = email.trim().toLowerCase();
    if (store.candidates.some((candidate) => candidate.organizationId === organizationId && candidate.email === normalizedEmail)) return { error: { status: 409, message: "해당 조직에 이미 등록된 이메일입니다." } };
    const candidate = { id: randomUUID(), name: name.trim(), email: normalizedEmail, birthDate, organizationId, candidateNumber: `AIVLE-${1000 + store.candidates.length + 1}`, status: "REGISTERED", createdAt: new Date().toISOString() };
    await store.addCandidate(candidate);
    return { candidate };
  };
  app.post("/api/manager/candidates", authenticate, requireManager, async (request, response, next) => {
    try {
      const result = await createCandidate(request, request.body.organizationId, request.body);
      if (result.error) return response.status(result.error.status).json({ message: result.error.message });
      return response.status(201).json(result.candidate);
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/manager/candidates/bulk", authenticate, requireManager, async (request, response, next) => {
    try {
      const { organizationId, candidates } = request.body;
      if (!Array.isArray(candidates) || candidates.length === 0) return response.status(400).json({ message: "일괄 등록할 응시자 목록을 입력해주세요." });
      if (!scopedOrganization(request, organizationId)) return response.status(403).json({ message: "배정된 승인 조직만 관리할 수 있습니다." });
      if (candidates.some((candidate) => !isNonEmptyText(candidate?.name) || !isNonEmptyText(candidate?.email) || !isValidBirthDate(candidate?.birthDate))) return response.status(400).json({ message: "모든 행에 이름, 이메일, 올바른 생년월일을 입력해주세요." });
      const emails = candidates.map((candidate) => candidate.email.trim().toLowerCase());
      if (new Set(emails).size !== emails.length || emails.some((email) => store.candidates.some((candidate) => candidate.organizationId === organizationId && candidate.email === email))) return response.status(409).json({ message: "중복된 응시자 이메일이 포함되어 있습니다." });
      const created = [];
      for (const candidateInput of candidates) {
        const result = await createCandidate(request, organizationId, candidateInput);
        if (result.error) return response.status(result.error.status).json({ message: result.error.message });
        created.push(result.candidate);
      }
      return response.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/candidates/batch-delete", authenticate, requireManager, async (request, response, next) => {
    try {
      const candidateIds = Array.isArray(request.body.candidateIds) ? [...new Set(request.body.candidateIds.filter(isNonEmptyText))] : [];
      if (candidateIds.length === 0) return response.status(400).json({ message: "삭제할 응시자를 선택해주세요." });
      const candidates = store.candidates.filter((candidate) => candidateIds.includes(candidate.id));
      if (candidates.length !== candidateIds.length) return response.status(404).json({ message: "삭제할 응시자 정보를 찾을 수 없습니다." });
      if (candidates.some((candidate) => !scopedOrganization(request, candidate.organizationId))) return response.status(403).json({ message: "배정된 승인 조직의 응시자만 삭제할 수 있습니다." });
      const removedCandidateIds = await store.removeCandidates(candidateIds);
      return response.json({ removedCount: removedCandidateIds.size, candidateIds: [...removedCandidateIds] });
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/candidates/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const candidate = store.candidates.find((item) => item.id === request.params.id);
      if (!candidate) return response.status(404).json({ message: "응시자를 찾을 수 없습니다." });
      if (!scopedOrganization(request, candidate.organizationId)) return response.status(403).json({ message: "배정된 승인 조직의 응시자만 삭제할 수 있습니다." });
      await store.removeCandidates([candidate.id]);
      return response.json({ id: candidate.id });
    } catch (error) {
      return next(error);
    }
  });
  app.patch("/api/manager/candidates/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const candidate = store.candidates.find((item) => item.id === request.params.id);
      if (!candidate) return response.status(404).json({ message: "응시자를 찾을 수 없습니다." });
      if (!scopedOrganization(request, candidate.organizationId)) return response.status(403).json({ message: "배정된 승인 조직의 응시자만 수정할 수 있습니다." });
      const { name, email, birthDate } = request.body;
      if (![name, email, birthDate].every(isNonEmptyText) || !isValidBirthDate(birthDate)) return response.status(400).json({ message: "응시자 이름, 이메일, 올바른 생년월일을 입력해주세요." });
      const normalizedEmail = email.trim().toLowerCase();
      if (store.candidates.some((item) => item.id !== candidate.id && item.organizationId === candidate.organizationId && item.email === normalizedEmail)) return response.status(409).json({ message: "해당 조직에 이미 등록된 이메일입니다." });
      return response.json(await store.updateCandidate(candidate.id, { name: name.trim(), email: normalizedEmail, birthDate }));
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/manager/exams", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    response.json(store.exams.filter((exam) => organizationIds.includes(exam.organizationId)).map((exam) => ({
      ...exam,
      organizationName: store.organizations.find((organization) => organization.id === exam.organizationId)?.name ?? "조직",
      questionCount: store.questions.filter((question) => question.examId === exam.id).length,
      examineeCount: store.assignments.filter((assignment) => assignment.examId === exam.id).length
    })));
  });
  app.get("/api/manager/notices", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    response.json(store.notices
      .filter((notice) => notice.organizationId && organizationIds.includes(notice.organizationId))
      .sort(noticeSort)
      .map(publicNotice));
  });
  const managerNoticeTarget = (request) => {
    const scope = request.body.scope === "EXAM" ? "EXAM" : "ORGANIZATION";
    const organizationId = typeof request.body.organizationId === "string" ? request.body.organizationId : "";
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    if (!organizationIds.includes(organizationId)) return { error: "배정된 조직의 공지만 관리할 수 있습니다.", status: 403 };
    if (scope === "EXAM") {
      const exam = store.exams.find((item) => item.id === request.body.examId && item.organizationId === organizationId);
      if (!exam) return { error: "선택한 조직에 속한 시험을 찾을 수 없습니다.", status: 400 };
      return { scope, organizationId, examId: exam.id };
    }
    return { scope, organizationId, examId: null };
  };
  app.post("/api/manager/notices", authenticate, requireManager, async (request, response, next) => {
    try {
      const target = managerNoticeTarget(request);
      if (target.error) return response.status(target.status).json({ message: target.error });
      const input = normalizeNoticeInput(request.body);
      if (!input.title || !input.content) return response.status(400).json({ message: "공지 제목과 내용을 입력해주세요." });
      if (input.publishStartAt === undefined || input.publishEndAt === undefined) return response.status(400).json({ message: "게시 기간을 올바르게 입력해주세요." });
      if (input.publishStartAt && input.publishEndAt && new Date(input.publishStartAt) > new Date(input.publishEndAt)) return response.status(400).json({ message: "게시 종료일은 시작일 이후여야 합니다." });
      const now = new Date().toISOString();
      const notice = await store.addNotice({ id: randomUUID(), ...input, ...target, publishedAt: input.publishStartAt ?? now, viewCount: 0, authorId: request.user.id, createdAt: now, updatedAt: now });
      return response.status(201).json(publicNotice(notice));
    } catch (error) {
      return next(error);
    }
  });
  app.patch("/api/manager/notices/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const organizationIds = managerOrganizationIds(request.user, store.organizations);
      const existing = store.notices.find((item) => item.id === request.params.id);
      if (!existing) return response.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      if (!existing.organizationId || !organizationIds.includes(existing.organizationId)) return response.status(403).json({ message: "다른 조직의 공지는 수정할 수 없습니다." });
      const target = managerNoticeTarget(request);
      if (target.error) return response.status(target.status).json({ message: target.error });
      const input = normalizeNoticeInput({ ...existing, ...request.body });
      if (!input.title || !input.content) return response.status(400).json({ message: "공지 제목과 내용을 입력해주세요." });
      const notice = await store.updateNotice(existing.id, { ...input, ...target, publishedAt: input.publishStartAt ?? existing.publishedAt, updatedAt: new Date().toISOString() });
      return response.json(publicNotice(notice));
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/notices/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const organizationIds = managerOrganizationIds(request.user, store.organizations);
      const existing = store.notices.find((item) => item.id === request.params.id);
      if (!existing) return response.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      if (!existing.organizationId || !organizationIds.includes(existing.organizationId)) return response.status(403).json({ message: "다른 조직의 공지는 삭제할 수 없습니다." });
      await store.removeNotice(existing.id);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });
  const managerCommunityPost = (request) => {
    const organizationId = typeof request.body.organizationId === "string" ? request.body.organizationId : "";
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    if (!organizationIds.includes(organizationId)) return { error: "배정된 조직의 게시판만 이용할 수 있습니다.", status: 403 };
    const examId = typeof request.body.examId === "string" && request.body.examId ? request.body.examId : null;
    if (examId && !store.exams.some((exam) => exam.id === examId && exam.organizationId === organizationId)) {
      return { error: "선택한 조직에 속한 시험을 찾을 수 없습니다.", status: 400 };
    }
    const categories = new Set(["GENERAL", "QUESTION", "RESOURCE", "SUGGESTION"]);
    return {
      organizationId,
      examId,
      category: categories.has(request.body.category) ? request.body.category : "GENERAL",
      title: typeof request.body.title === "string" ? request.body.title.trim() : "",
      content: typeof request.body.content === "string" ? request.body.content.trim() : ""
    };
  };
  app.get("/api/manager/community", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const query = String(request.query.q ?? "").trim().toLowerCase();
    const category = String(request.query.category ?? "ALL");
    response.json(store.communityPosts
      .filter((post) => organizationIds.includes(post.organizationId))
      .filter((post) => category === "ALL" || post.category === category)
      .filter((post) => !query || `${post.title} ${post.content}`.toLowerCase().includes(query))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((post) => ({ ...publicCommunityPost(post), canEdit: post.authorId === request.user.id })));
  });
  app.get("/api/manager/community/:id", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const post = store.communityPosts.find((item) => item.id === request.params.id && organizationIds.includes(item.organizationId));
    if (!post) return response.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    const payload = publicCommunityPost(post, true);
    return response.json({
      ...payload,
      canEdit: post.authorId === request.user.id,
      comments: payload.comments.map((comment) => ({ ...comment, canDelete: comment.authorId === request.user.id }))
    });
  });
  app.post("/api/manager/community", authenticate, requireManager, async (request, response, next) => {
    try {
      const input = managerCommunityPost(request);
      if (input.error) return response.status(input.status).json({ message: input.error });
      if (!input.title || !input.content) return response.status(400).json({ message: "제목과 내용을 입력해주세요." });
      const now = new Date().toISOString();
      const post = await store.addCommunityPost({ id: randomUUID(), ...input, authorId: request.user.id, status: "OPEN", pinned: false, createdAt: now, updatedAt: now });
      return response.status(201).json(publicCommunityPost(post));
    } catch (error) {
      return next(error);
    }
  });
  app.patch("/api/manager/community/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const post = store.communityPosts.find((item) => item.id === request.params.id);
      if (!post) return response.status(404).json({ message: "게시글을 찾을 수 없습니다." });
      if (post.authorId !== request.user.id) return response.status(403).json({ message: "본인이 작성한 게시글만 수정할 수 있습니다." });
      const input = managerCommunityPost(request);
      if (input.error) return response.status(input.status).json({ message: input.error });
      if (!input.title || !input.content) return response.status(400).json({ message: "제목과 내용을 입력해주세요." });
      const status = request.body.status === "RESOLVED" ? "RESOLVED" : "OPEN";
      const updated = await store.updateCommunityPost(post.id, { ...input, status, updatedAt: new Date().toISOString() });
      return response.json(publicCommunityPost(updated));
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/community/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const post = store.communityPosts.find((item) => item.id === request.params.id);
      if (!post) return response.status(404).json({ message: "게시글을 찾을 수 없습니다." });
      if (post.authorId !== request.user.id) return response.status(403).json({ message: "본인이 작성한 게시글만 삭제할 수 있습니다." });
      await store.removeCommunityPost(post.id);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/manager/community/:id/comments", authenticate, requireManager, async (request, response, next) => {
    try {
      const organizationIds = managerOrganizationIds(request.user, store.organizations);
      const post = store.communityPosts.find((item) => item.id === request.params.id && organizationIds.includes(item.organizationId));
      if (!post) return response.status(404).json({ message: "게시글을 찾을 수 없습니다." });
      const content = typeof request.body.content === "string" ? request.body.content.trim() : "";
      if (!content) return response.status(400).json({ message: "댓글 내용을 입력해주세요." });
      const now = new Date().toISOString();
      const comment = await store.addCommunityComment({ id: randomUUID(), postId: post.id, authorId: request.user.id, content, createdAt: now, updatedAt: now });
      return response.status(201).json(publicCommunityComment(comment));
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/community/:postId/comments/:commentId", authenticate, requireManager, async (request, response, next) => {
    try {
      const comment = store.communityComments.find((item) => item.id === request.params.commentId && item.postId === request.params.postId);
      if (!comment) return response.status(404).json({ message: "댓글을 찾을 수 없습니다." });
      if (comment.authorId !== request.user.id) return response.status(403).json({ message: "본인이 작성한 댓글만 삭제할 수 있습니다." });
      await store.removeCommunityComment(comment.id);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/manager/exams", authenticate, requireManager, async (request, response, next) => {
    try {
      const { title, duration, questions, date, organizationId } = request.body;
      if (![title, duration, questions, date, organizationId].every(isNonEmptyText)) return response.status(400).json({ message: "조직, 시험명, 제한 시간, 시험 일정을 모두 입력해주세요." });
      if (!scopedOrganization(request, organizationId)) return response.status(403).json({ message: "배정된 승인 조직만 시험을 만들 수 있습니다." });
      const exam = { id: randomUUID(), title: title.trim(), duration: duration.trim(), questions: questions.trim(), date: date.trim(), category: "정규 평가", status: "AVAILABLE", organizationId };
      if (!scheduledExamEndsAt(exam)) return response.status(400).json({ message: "시험 일정과 제한 시간을 올바르게 입력해주세요." });
      await store.addExam(exam);
      return response.status(201).json(exam);
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/manager/exams/:id/questions", authenticate, requireManager, (request, response) => {
    if (!scopedExam(request, request.params.id)) return response.status(403).json({ message: "배정된 승인 조직의 시험만 조회할 수 있습니다." });
    return response.json(store.questions.filter((question) => question.examId === request.params.id));
  });
  app.get("/api/supervisor/exams/:id/policies", authenticate, requireManager, (request, response) => {
    const exam = scopedExam(request, request.params.id);
    if (!exam) return response.status(403).json({ message: "배정된 승인 조직의 시험 정책만 조회할 수 있습니다." });
    return response.json(exam.examPolicies ?? store.systemPolicies);
  });
  app.patch("/api/supervisor/exams/:id/policies", authenticate, requireManager, async (request, response, next) => {
    try {
      const exam = scopedExam(request, request.params.id);
      if (!exam) return response.status(403).json({ message: "배정된 승인 조직의 시험 정책만 수정할 수 있습니다." });
      const aiAnalysisEnabled = request.body.aiAnalysisEnabled;
      const cheatDetection = request.body.cheatDetection;
      const validCheatDetection = cheatDetection && typeof cheatDetection.gazeWarningEnabled === "boolean" && typeof cheatDetection.audioDetectionEnabled === "boolean" && typeof cheatDetection.tabSwitchSubmitEnabled === "boolean";
      if (typeof aiAnalysisEnabled !== "boolean" || !validCheatDetection) return response.status(400).json({ message: "정책 값을 확인해주세요." });
      const updated = await store.updateExam(exam.id, { examPolicies: { aiAnalysisEnabled, cheatDetection } });
      return response.json(updated.examPolicies);
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/manager/exams/:id/candidates", authenticate, requireManager, (request, response) => {
    const exam = scopedExam(request, request.params.id);
    if (!exam) return response.status(403).json({ message: "배정된 승인 조직의 시험만 조회할 수 있습니다." });
    const assignedCandidateIds = new Set(store.assignments.filter((assignment) => assignment.examId === exam.id).map((assignment) => assignment.candidateId));
    return response.json(store.candidates.filter((candidate) => assignedCandidateIds.has(candidate.id)));
  });
  app.post("/api/manager/exams/:id/questions", authenticate, requireManager, async (request, response, next) => {
    try {
      if (!scopedExam(request, request.params.id)) return response.status(403).json({ message: "배정된 승인 조직의 시험만 관리할 수 있습니다." });
      if (request.body.type === "CODING") {
        const { title, languages, description, inputFormat, outputFormat, constraints, publicExamples, hiddenTestCases, judgeMode, numericTolerance, customJudgeCode, referenceSolutions } = request.body;
        const normalizedLanguages = Array.isArray(languages) ? [...new Set(languages.filter((language) => codingLanguages.has(language)))] : [];
        const normalizedPublicExamples = normalizeTestCases(publicExamples, true);
        const normalizedHiddenTestCases = normalizeTestCases(hiddenTestCases, true);
        const normalizedReferenceSolutions = Object.fromEntries(Object.entries(referenceSolutions && typeof referenceSolutions === "object" ? referenceSolutions : {}).filter(([language, source]) => codingLanguages.has(language) && isNonEmptyText(source)).map(([language, source]) => [language, source.trim()]));
        if (![title, description, inputFormat, outputFormat, constraints].every(isNonEmptyText) || !normalizedLanguages.length || !normalizedPublicExamples || !normalizedHiddenTestCases || !judgeModes.has(judgeMode)) return response.status(400).json({ message: "코딩 문제 정보, 입출력 형식, 공개 예제, 숨김 테스트를 모두 입력해주세요." });
        if (judgeMode === "NUMERIC_TOLERANCE" && (!Number.isFinite(numericTolerance) || numericTolerance < 0)) return response.status(400).json({ message: "숫자 오차 허용 범위를 입력해주세요." });
        if (judgeMode === "CUSTOM" && !isNonEmptyText(customJudgeCode)) return response.status(400).json({ message: "별도 채점 코드를 입력해주세요." });
        const question = {
          id: randomUUID(), examId: request.params.id, type: "CODING", title: title.trim(), prompt: description.trim(), description: description.trim(),
          languages: normalizedLanguages, inputFormat: inputFormat.trim(), outputFormat: outputFormat.trim(), constraints: constraints.trim(),
          publicExamples: normalizedPublicExamples, hiddenTestCases: normalizedHiddenTestCases, judgeMode, numericTolerance: judgeMode === "NUMERIC_TOLERANCE" ? numericTolerance : undefined,
          customJudgeCode: judgeMode === "CUSTOM" ? customJudgeCode.trim() : undefined, referenceSolutions: normalizedReferenceSolutions, createdAt: new Date().toISOString()
        };
        await store.addQuestion(question);
        return response.status(201).json(question);
      }
      const { prompt, options, answer } = request.body;
      if (!isNonEmptyText(prompt) || !Array.isArray(options) || options.length < 2 || !isNonEmptyText(answer)) return response.status(400).json({ message: "문제, 선택지, 정답을 입력해주세요." });
      const normalizedOptions = [...new Set(options.map((option) => String(option).trim()).filter(Boolean))];
      const normalizedAnswer = answer.trim();
      if (normalizedOptions.length < 2) return response.status(400).json({ message: "선택지는 2개 이상 입력해주세요." });
      if (!normalizedOptions.includes(normalizedAnswer)) return response.status(400).json({ message: "정답은 보기 중 하나여야 합니다." });
      const question = { id: randomUUID(), examId: request.params.id, type: "MULTIPLE_CHOICE", prompt: prompt.trim(), options: normalizedOptions, answer: normalizedAnswer, createdAt: new Date().toISOString() };
      await store.addQuestion(question);
      return response.status(201).json(question);
    } catch (error) {
      return next(error);
    }
  });
  app.patch("/api/manager/exams/:examId/questions/:questionId", authenticate, requireManager, async (request, response, next) => {
    try {
      if (!scopedExam(request, request.params.examId)) return response.status(403).json({ message: "배정된 승인 조직의 시험만 관리할 수 있습니다." });
      const current = store.questions.find((question) => question.id === request.params.questionId && question.examId === request.params.examId);
      if (!current) return response.status(404).json({ message: "문제를 찾을 수 없습니다." });
      if (current.type !== "CODING" && request.body.type === "CODING") return response.status(400).json({ message: "문제 유형은 변경할 수 없습니다." });
      if (current.type === "CODING" && request.body.type !== "CODING") return response.status(400).json({ message: "문제 유형은 변경할 수 없습니다." });
      if (current.type !== "CODING") {
        const { prompt, options, answer } = request.body;
        const normalizedOptions = Array.isArray(options) ? [...new Set(options.map((option) => String(option).trim()).filter(Boolean))] : [];
        const normalizedAnswer = typeof answer === "string" ? answer.trim() : "";
        if (!isNonEmptyText(prompt) || normalizedOptions.length < 2 || !normalizedOptions.includes(normalizedAnswer)) return response.status(400).json({ message: "문제, 두 개 이상의 선택지, 선택지에 포함된 정답을 입력해주세요." });
        const question = await store.updateQuestion(current.id, { type: "MULTIPLE_CHOICE", prompt: prompt.trim(), options: normalizedOptions, answer: normalizedAnswer, updatedAt: new Date().toISOString() });
        return response.json(question);
      }
      const { title, languages, description, inputFormat, outputFormat, constraints, publicExamples, hiddenTestCases, judgeMode, numericTolerance, customJudgeCode, referenceSolutions } = request.body;
      const normalizedLanguages = Array.isArray(languages) ? [...new Set(languages.filter((language) => codingLanguages.has(language)))] : [];
      const normalizedPublicExamples = normalizeTestCases(publicExamples, true);
      const normalizedHiddenTestCases = normalizeTestCases(hiddenTestCases, true);
      const normalizedReferenceSolutions = Object.fromEntries(Object.entries(referenceSolutions && typeof referenceSolutions === "object" ? referenceSolutions : {}).filter(([language, source]) => codingLanguages.has(language) && isNonEmptyText(source)).map(([language, source]) => [language, source.trim()]));
      if (![title, description, inputFormat, outputFormat, constraints].every(isNonEmptyText) || !normalizedLanguages.length || !normalizedPublicExamples || !normalizedHiddenTestCases || !judgeModes.has(judgeMode)) return response.status(400).json({ message: "코딩 문제 정보, 입출력 형식, 공개 예제, 숨김 테스트를 모두 입력해주세요." });
      if (judgeMode === "NUMERIC_TOLERANCE" && (!Number.isFinite(numericTolerance) || numericTolerance < 0)) return response.status(400).json({ message: "숫자 오차 허용 범위를 입력해주세요." });
      if (judgeMode === "CUSTOM" && !isNonEmptyText(customJudgeCode)) return response.status(400).json({ message: "별도 채점 코드를 입력해주세요." });
      const question = await store.updateQuestion(current.id, {
        title: title.trim(), prompt: description.trim(), description: description.trim(), languages: normalizedLanguages,
        inputFormat: inputFormat.trim(), outputFormat: outputFormat.trim(), constraints: constraints.trim(), publicExamples: normalizedPublicExamples, hiddenTestCases: normalizedHiddenTestCases,
        judgeMode, numericTolerance: judgeMode === "NUMERIC_TOLERANCE" ? numericTolerance : undefined, customJudgeCode: judgeMode === "CUSTOM" ? customJudgeCode.trim() : undefined,
        referenceSolutions: normalizedReferenceSolutions, updatedAt: new Date().toISOString()
      });
      return response.json(question);
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/exams/:examId/questions/:questionId", authenticate, requireManager, async (request, response, next) => {
    try {
      if (!scopedExam(request, request.params.examId)) return response.status(403).json({ message: "배정된 승인 조직의 시험만 관리할 수 있습니다." });
      const question = store.questions.find((item) => item.id === request.params.questionId && item.examId === request.params.examId);
      if (!question) return response.status(404).json({ message: "문제를 찾을 수 없습니다." });
      if (store.invitations.some((invitation) => invitation.examId === request.params.examId)) return response.status(409).json({ message: "초대 발송 이력이 있는 시험의 문제는 삭제할 수 없습니다." });
      await store.removeQuestion(question.id);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });
  const scopedExam = (request, examId) => {
    const exam = store.exams.find((candidate) => candidate.id === examId);
    return exam && scopedOrganization(request, exam.organizationId) ? exam : undefined;
  };
  app.patch("/api/manager/exams/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const exam = scopedExam(request, request.params.id);
      const date = typeof request.body.date === "string" ? request.body.date.trim() : "";
      if (!exam) return response.status(404).json({ message: "시험을 찾을 수 없습니다." });
      if (!isNonEmptyText(date)) return response.status(400).json({ message: "시험 시작 일시를 입력해주세요." });
      const nextExam = { ...exam, date };
      const expiresAt = scheduledExamEndsAt(nextExam);
      if (!expiresAt) return response.status(400).json({ message: "시험 일정과 제한 시간을 올바르게 입력해주세요." });
      const updated = await store.updateExam(exam.id, { date, updatedAt: new Date().toISOString() });
      await Promise.all(store.invitations
        .filter((invitation) => invitation.examId === exam.id && !invitation.revokedAt)
        .map((invitation) => store.updateInvitation(invitation.id, { expiresAt })));
      return response.json({ ...updated, invitationExpiresAt: expiresAt });
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/exams/:id", authenticate, requireManager, async (request, response, next) => {
    try {
      const exam = scopedExam(request, request.params.id);
      if (!exam) return response.status(404).json({ message: "시험을 찾을 수 없습니다." });
      const invitationIds = new Set(store.invitations.filter((invitation) => invitation.examId === exam.id).map((invitation) => invitation.id));
      for (const [tokenHash, session] of sessions) {
        if (invitationIds.has(session.invitationId)) sessions.delete(tokenHash);
      }
      for (const [id, liveSession] of liveSessions) {
        if (liveSession.examId === exam.id) liveSessions.delete(id);
      }
      for (const [token, device] of auxiliaryDevices) {
        if (device.examId === exam.id) auxiliaryDevices.delete(token);
      }
      for (const [token, scan] of idCardScans) {
        if (scan.examId === exam.id) idCardScans.delete(token);
      }
      await store.removeExam(exam.id);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/manager/exams/:id/assign", authenticate, requireManager, async (request, response, next) => {
    try {
      const exam = scopedExam(request, request.params.id);
      const candidateIds = Array.isArray(request.body.candidateIds) ? [...new Set(request.body.candidateIds.filter(isNonEmptyText))] : [];
      if (!exam || candidateIds.length === 0) return response.status(400).json({ message: "시험과 배정할 응시자를 확인해주세요." });
      const requestedCandidates = store.candidates.filter((candidate) => candidateIds.includes(candidate.id));
      if (requestedCandidates.length !== candidateIds.length) return response.status(404).json({ message: "선택한 응시자 중 삭제되었거나 존재하지 않는 정보가 있습니다. 목록을 새로고침한 뒤 다시 선택해주세요." });
      if (requestedCandidates.some((candidate) => candidate.organizationId !== exam.organizationId)) return response.status(403).json({ message: "현재 시험과 같은 조직에 등록된 응시자만 배정할 수 있습니다." });
      const candidates = requestedCandidates;
      const created = [];
      for (const candidate of candidates) {
        if (!store.assignments.some((assignment) => assignment.examId === exam.id && assignment.candidateId === candidate.id)) {
          const assignment = { id: randomUUID(), examId: exam.id, candidateId: candidate.id, status: "ASSIGNED" };
          await store.addAssignment(assignment);
          await store.addExaminee({ id: randomUUID(), candidateId: candidate.id, name: candidate.name, organizationId: candidate.organizationId, examId: exam.id, status: "NOT_STARTED", statusText: "미접속", currentProb: "시험 시작 전" });
          created.push(assignment);
        }
      }
      return response.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  });
  app.delete("/api/manager/exams/:id/assignments", authenticate, requireManager, async (request, response, next) => {
    try {
      const exam = scopedExam(request, request.params.id);
      const candidateIds = Array.isArray(request.body.candidateIds) ? request.body.candidateIds : [];
      if (!exam || candidateIds.length === 0) return response.status(400).json({ message: "시험과 배정 해제할 응시자를 확인해주세요." });
      const candidates = store.candidates.filter((candidate) => candidateIds.includes(candidate.id) && candidate.organizationId === exam.organizationId);
      if (candidates.length !== candidateIds.length) return response.status(403).json({ message: "같은 조직의 응시자만 배정 해제할 수 있습니다." });
      const submittedCandidateIds = new Set([
        ...store.assignments.filter((assignment) => assignment.examId === exam.id && candidateIds.includes(assignment.candidateId) && assignment.status === "SUBMITTED").map((assignment) => assignment.candidateId),
        ...store.invitations.filter((invitation) => invitation.examId === exam.id && candidateIds.includes(invitation.candidateId) && invitation.submittedAt).map((invitation) => invitation.candidateId)
      ]);
      if (submittedCandidateIds.size > 0) return response.status(409).json({ message: "제출이 완료된 응시자의 배정은 삭제할 수 없습니다." });
      const assignedCandidateIds = new Set(store.assignments
        .filter((assignment) => assignment.examId === exam.id && candidateIds.includes(assignment.candidateId))
        .map((assignment) => assignment.candidateId));
      const { assignmentIds } = await store.removeExamAssignments(exam.id, candidateIds);
      return response.json({ removedCount: assignmentIds.size, candidateIds: [...assignedCandidateIds] });
    } catch (error) {
      return next(error);
    }
  });
  app.post("/api/manager/exams/:id/invitations/send", authenticate, requireManager, async (request, response, next) => {
    try {
      const exam = scopedExam(request, request.params.id);
      const candidateIds = Array.isArray(request.body.candidateIds) ? request.body.candidateIds : [];
      if (!exam || candidateIds.length === 0) return response.status(400).json({ message: "시험과 초대할 응시자를 확인해주세요." });
      const eligibleCandidateIds = candidateIds.filter((candidateId) => store.assignments.some((assignment) => assignment.examId === exam.id && assignment.candidateId === candidateId));
      if (eligibleCandidateIds.length !== candidateIds.length) return response.status(409).json({ message: "시험 대상자로 먼저 배정한 응시자만 초대할 수 있습니다." });
      const expiresAt = scheduledExamEndsAt(exam);
      if (!expiresAt) return response.status(409).json({ message: "시험 일정과 제한 시간을 확인한 뒤 초대해주세요." });
      if (new Date(expiresAt) <= new Date()) return response.status(409).json({ message: "이미 종료된 시험에는 초대 링크를 발송할 수 없습니다." });
      const previews = [];
      const createdInvitationIds = [];
      for (const candidate of store.candidates.filter((item) => eligibleCandidateIds.includes(item.id) && item.organizationId === exam.organizationId)) {
        const activeInvitations = store.invitations.filter((item) => item.examId === exam.id && item.candidateId === candidate.id && invitationStatus(item) === "ACTIVE");
        await Promise.all(activeInvitations.map((item) => store.updateInvitation(item.id, { revokedAt: new Date().toISOString(), revokedReason: "재발송으로 인한 자동 폐기" })));
        const token = randomUUID();
        const invitation = { id: randomUUID(), tokenHash: hashToken(token), examId: exam.id, organizationId: exam.organizationId, candidateId: candidate.id, candidateNumber: candidate.candidateNumber, expiresAt, sentAt: new Date().toISOString(), verifiedAt: null, submittedAt: null, revokedAt: null, deliveryStatus: "PENDING" };
        await store.addInvitation(invitation);
        createdInvitationIds.push(invitation.id);
        previews.push({ to: candidate.email, examName: exam.title, schedule: exam.date, entryLink: new URL("/exam/enter?token=" + encodeURIComponent(token), publicWebOrigin).toString(), candidateNumber: candidate.candidateNumber, notice: "시험 시작 전 웹캠, 마이크, 화면 공유를 점검해주세요.", expiresAt, oneTimeToken: token });
      }
      let deliveryStatus;
      try {
        const deliveries = await Promise.all(previews.map((preview) => sendSendGridEmail({
          to: preview.to,
          subject: "[Aivle] " + preview.examName + " 시험 초대",
          html: "<p>안녕하세요.</p><p><strong>" + escapeHtml(preview.examName) + "</strong> 시험에 초대되었습니다.</p><ul><li>응시번호: " + escapeHtml(preview.candidateNumber) + "</li><li>시험 일정: " + escapeHtml(preview.schedule) + "</li><li>입장 링크 만료: " + escapeHtml(preview.expiresAt) + "</li></ul><p>" + escapeHtml(preview.notice) + "</p><p><a href=\"" + escapeHtml(preview.entryLink) + "\">시험 입장하기</a></p>",
          text: preview.examName + " 시험에 초대되었습니다. 응시번호: " + preview.candidateNumber + ". 시험 일정: " + preview.schedule + ". 입장 링크: " + preview.entryLink + ". " + preview.notice
        })));
        deliveryStatus = deliveries.every(Boolean) ? "SENT" : "PREVIEW";
        await Promise.all(createdInvitationIds.map((id) => store.updateInvitation(id, { deliveryStatus })));
      } catch {
        await Promise.all(createdInvitationIds.map((id) => store.updateInvitation(id, { revokedAt: new Date().toISOString(), revokedReason: "이메일 발송 실패", deliveryStatus: "FAILED" })));
        return response.status(502).json({ message: "초대 메일 전송에 실패했습니다." });
      }
      const safePreviews = previews.map(({ oneTimeToken, ...preview }) => preview);
      return response.status(201).json({ count: safePreviews.length, deliveryStatus, mailPreviews: safePreviews });
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/manager/invitations", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    response.json(store.invitations.filter((invitation) => organizationIds.includes(invitation.organizationId)).map(({ token, ...invitation }) => invitation));
  });
  app.get("/api/invitations/:token/notices", (request, response) => {
    const invitation = invitationForToken(store.invitations, request.params.token);
    if (!invitation || invitation.usedAt || invitation.revokedAt || new Date(invitation.expiresAt) < new Date()) return response.status(410).json({ message: "만료되었거나 이미 사용된 초대 링크입니다." });
    const exam = store.exams.find((candidate) => candidate.id === invitation.examId);
    return response.json(store.notices
      .filter((notice) => {
        const scope = notice.scope ?? "GLOBAL";
        return scope === "GLOBAL"
          || (scope === "ORGANIZATION" && notice.organizationId === invitation.organizationId)
          || (scope === "EXAM" && notice.examId === exam?.id);
      })
      .filter((notice) => isPublishedNotice(notice))
      .sort(noticeSort)
      .map(publicNotice));
  });
  app.get("/api/invitations/:token/notices/:id", async (request, response, next) => {
    try {
      const invitation = invitationForToken(store.invitations, request.params.token);
      if (!invitation || invitation.usedAt || invitation.revokedAt || new Date(invitation.expiresAt) < new Date()) return response.status(410).json({ message: "만료되었거나 이미 사용된 초대 링크입니다." });
      const notice = store.notices.find((item) => item.id === request.params.id);
      const scope = notice?.scope ?? "GLOBAL";
      const canView = notice && (
        scope === "GLOBAL"
        || (scope === "ORGANIZATION" && notice.organizationId === invitation.organizationId)
        || (scope === "EXAM" && notice.examId === invitation.examId)
      );
      if (!canView || !isPublishedNotice(notice)) return response.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      const updated = await store.updateNotice(notice.id, { viewCount: (notice.viewCount ?? 0) + 1 });
      return response.json(publicNotice(updated));
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/invitations/:token", (request, response) => {
    const invitation = invitationForToken(store.invitations, request.params.token);
    if (invitation?.submittedAt) return response.status(410).json({ message: "제출이 완료된 시험의 초대 링크입니다." });
    if (!invitation || invitation.usedAt || invitation.revokedAt || new Date(invitation.expiresAt) < new Date()) return response.status(410).json({ message: "만료되었거나 이미 사용된 초대 링크입니다." });
    const exam = store.exams.find((candidate) => candidate.id === invitation.examId);
    const organization = store.organizations.find((candidate) => candidate.id === invitation.organizationId);
    const candidate = store.candidates.find((candidate) => candidate.id === invitation.candidateId);
    return response.json({ organizationName: organization?.name ?? "조직", candidateName: candidate?.name ?? "응시자", examName: exam?.title ?? "시험", schedule: exam?.date ?? "일정 미정", duration: exam?.duration ?? "제한 시간 미정", questions: exam?.questions ?? "문항 수 미정", expiresAt: invitation.expiresAt });
  });
  app.post("/api/invitations/:token/verify", async (request, response, next) => {
    try {
      const invitation = invitationForToken(store.invitations, request.params.token);
      if (invitation?.submittedAt) return response.status(410).json({ message: "제출이 완료된 시험의 초대 링크입니다." });
      if (!invitation || invitation.usedAt || invitation.revokedAt || new Date(invitation.expiresAt) < new Date()) return response.status(410).json({ message: "만료되었거나 이미 사용된 초대 링크입니다." });
      const cooldownMs = store.systemPolicies.invitationSecurity.reverificationCooldownMinutes * 60 * 1000;
      if (invitation.verifiedAt && cooldownMs > 0 && Date.now() - new Date(invitation.verifiedAt).getTime() < cooldownMs) return response.status(429).json({ message: "동일 링크 재인증 제한 시간이 남아 있습니다. 잠시 후 다시 시도해주세요." });
      const failureKey = `${request.ip}:${invitation.id}`;
      const failure = candidateFailures.get(failureKey);
      if (failure && failure.blockedUntil > Date.now()) return response.status(429).json({ message: "응시번호 입력 횟수를 초과했습니다. 잠시 후 다시 시도해주세요." });
      if (failure && failure.blockedUntil <= Date.now()) candidateFailures.delete(failureKey);
      if (request.body.candidateNumber?.trim() !== invitation.candidateNumber) {
        const attempts = (failure?.attempts ?? 0) + 1;
        const attemptLimit = store.systemPolicies.invitationSecurity.maxVerificationAttempts;
        candidateFailures.set(failureKey, { attempts, blockedUntil: attempts >= attemptLimit ? Date.now() + store.systemPolicies.invitationSecurity.verificationLockoutMinutes * 60 * 1000 : 0 });
        return response.status(attempts >= attemptLimit ? 429 : 401).json({ message: attempts >= attemptLimit ? "응시번호 입력 횟수를 초과했습니다. 잠시 후 다시 시도해주세요." : "응시번호가 일치하지 않습니다." });
      }
      candidateFailures.delete(failureKey);
      const existingExaminee = store.examinees.find((examinee) => examinee.examId === invitation.examId && examinee.candidateId === invitation.candidateId);
      if (existingExaminee) await store.updateExaminee(existingExaminee.id, { status: "NORMAL", statusText: "시험 입장 완료", currentProb: "시험 시작 전" });
      else await store.addExaminee({ id: randomUUID(), candidateId: invitation.candidateId, name: store.candidates.find((candidate) => candidate.id === invitation.candidateId)?.name ?? "응시자", organizationId: invitation.organizationId, examId: invitation.examId, status: "NORMAL", statusText: "시험 입장 완료", currentProb: "시험 시작 전" });
      const accessToken = randomUUID();
      const session = { tokenHash: hashToken(accessToken), role: "APPLICANT", invitationId: invitation.id, expiresAt: new Date(Date.now() + store.systemPolicies.invitationSecurity.applicantSessionMinutes * 60 * 1000).toISOString() };
      sessions.set(session.tokenHash, session);
      await store.updateInvitation(invitation.id, { verifiedAt: invitation.verifiedAt ?? new Date().toISOString() });
      await store.addSession(session);
      return response.json({ accessToken, examId: invitation.examId, candidateNumber: invitation.candidateNumber });
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/supervisor/exams", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const requestedOrganizationId = typeof request.query.organizationId === "string" ? request.query.organizationId : "";
    if (requestedOrganizationId && !organizationIds.includes(requestedOrganizationId)) return response.status(403).json({ message: "배정된 승인 조직만 조회할 수 있습니다." });
    return response.json(store.exams.filter((exam) => organizationIds.includes(exam.organizationId) && (!requestedOrganizationId || exam.organizationId === requestedOrganizationId)).map((exam) => ({
      ...exam,
      organizationName: store.organizations.find((organization) => organization.id === exam.organizationId)?.name ?? "조직",
      examineeCount: store.assignments.filter((assignment) => assignment.examId === exam.id).length
    })));
  });
  app.get("/api/supervisor/examinees", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const examId = typeof request.query.examId === "string" ? request.query.examId : "";
    const requestedOrganizationId = typeof request.query.organizationId === "string" ? request.query.organizationId : "";
    if (requestedOrganizationId && !organizationIds.includes(requestedOrganizationId)) return response.status(403).json({ message: "배정된 승인 조직의 응시자만 조회할 수 있습니다." });
    if (examId) {
      const exam = store.exams.find((candidate) => candidate.id === examId);
      if (!exam || !organizationIds.includes(exam.organizationId) || (requestedOrganizationId && exam.organizationId !== requestedOrganizationId)) return response.status(403).json({ message: "배정된 승인 조직의 시험만 관제할 수 있습니다." });
    }
    const assignedCandidates = store.assignments
      .filter((assignment) => !examId || assignment.examId === examId)
      .map((assignment) => ({ assignment, candidate: store.candidates.find((candidate) => candidate.id === assignment.candidateId) }))
      .filter(({ candidate }) => candidate && organizationIds.includes(candidate.organizationId) && (!requestedOrganizationId || candidate.organizationId === requestedOrganizationId))
      .map(({ assignment, candidate }) => {
        const examinee = store.examinees.find((item) => item.examId === assignment.examId && item.candidateId === candidate.id);
        return examinee ?? { id: `assignment-${assignment.examId}-${candidate.id}`, candidateId: candidate.id, name: candidate.name, organizationId: candidate.organizationId, examId: assignment.examId, status: "NOT_STARTED", statusText: "미접속", currentProb: "시험 시작 전" };
      });
    return response.json(assignedCandidates);
  });
  app.post("/api/supervisor/examinees/:id/live-offers", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const examinee = store.examinees.find((item) => item.id === request.params.id && organizationIds.includes(item.organizationId));
    if (!examinee || typeof request.body.offer?.sdp !== "string") return response.status(400).json({ message: "라이브 연결 대상을 확인해주세요." });
    const id = randomUUID();
    liveSessions.set(id, { id, source: "candidate", examId: examinee.examId, candidateId: examinee.candidateId, offer: request.body.offer, createdAt: Date.now() });
    return response.status(201).json({ id });
  });
  app.post("/api/supervisor/examinees/:id/auxiliary-live-offers", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const examinee = store.examinees.find((item) => item.id === request.params.id && organizationIds.includes(item.organizationId));
    const device = examinee && [...auxiliaryDevices.values()].find((item) => item.examId === examinee.examId && item.candidateId === examinee.candidateId && item.deviceToken && item.expiresAt > Date.now());
    if (!examinee || !device || typeof request.body.offer?.sdp !== "string") return response.status(400).json({ message: "연결된 보조 카메라를 확인해주세요." });
    const id = randomUUID();
    liveSessions.set(id, { id, source: "auxiliary", examId: examinee.examId, candidateId: examinee.candidateId, offer: request.body.offer, createdAt: Date.now() });
    return response.status(201).json({ id });
  });
  app.get("/api/supervisor/live-offers/:id", authenticate, requireManager, (request, response) => {
    const session = liveSessions.get(request.params.id);
    if (!session || Date.now() - session.createdAt >= 30000) return response.status(404).json({ message: "라이브 연결 요청이 만료되었습니다." });
    return response.json({ answer: session.answer ?? null });
  });
  app.post("/api/supervisor/examinees/:id/warnings", authenticate, requireManager, async (request, response, next) => {
    try {
      const organizationIds = managerOrganizationIds(request.user, store.organizations);
      const examId = typeof request.body.examId === "string" ? request.body.examId : "";
      const examinee = store.examinees.find((candidate) => candidate.id === request.params.id && candidate.organizationId && organizationIds.includes(candidate.organizationId) && (!examId || candidate.examId === examId));
      if (!examinee || !isNonEmptyText(request.body.message)) return response.status(400).json({ message: "경고 대상을 확인해주세요." });
      await store.addWarning({ id: randomUUID(), examineeId: examinee.id, examId: examinee.examId, organizationId: examinee.organizationId, message: request.body.message.trim(), source: "SUPERVISOR", createdAt: new Date().toISOString() });
      return response.status(201).json({ message: "경고를 전송했습니다." });
    } catch (error) {
      return next(error);
    }
  });
  app.get("/api/supervisor/warnings", authenticate, requireManager, (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const examId = typeof request.query.examId === "string" ? request.query.examId : "";
    const requestedOrganizationId = typeof request.query.organizationId === "string" ? request.query.organizationId : "";
    if (requestedOrganizationId && !organizationIds.includes(requestedOrganizationId)) return response.status(403).json({ message: "배정된 승인 조직의 경고 로그만 조회할 수 있습니다." });
    if (examId) {
      const exam = store.exams.find((candidate) => candidate.id === examId);
      if (!exam || !organizationIds.includes(exam.organizationId) || (requestedOrganizationId && exam.organizationId !== requestedOrganizationId)) return response.status(403).json({ message: "배정된 승인 조직의 시험 로그만 조회할 수 있습니다." });
    }
    return response.json(store.warnings.filter((warning) => organizationIds.includes(warning.organizationId) && (!requestedOrganizationId || warning.organizationId === requestedOrganizationId) && (!examId || warning.examId === examId)).map((warning) => ({
      ...warning,
      examineeName: store.examinees.find((examinee) => examinee.id === warning.examineeId)?.name ?? "응시자",
      examTitle: store.exams.find((exam) => exam.id === warning.examId)?.title ?? "시험"
    })));
  });
  app.get("/api/manager/results", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const examId = typeof request.query.examId === "string" ? request.query.examId : "";
    const requestedOrganizationId = typeof request.query.organizationId === "string" ? request.query.organizationId : "";
    if (requestedOrganizationId && !organizationIds.includes(requestedOrganizationId)) return response.status(403).json({ message: "배정된 승인 조직의 결과만 조회할 수 있습니다." });
    const exam = examId ? store.exams.find((candidate) => candidate.id === examId) : undefined;
    if (examId && (!exam || !organizationIds.includes(exam.organizationId) || (requestedOrganizationId && exam.organizationId !== requestedOrganizationId))) return response.status(403).json({ message: "배정된 승인 조직의 시험 결과만 조회할 수 있습니다." });
    const rows = store.assignments.filter((assignment) => {
      const candidate = store.candidates.find((item) => item.id === assignment.candidateId);
      return candidate && organizationIds.includes(candidate.organizationId) && (!requestedOrganizationId || candidate.organizationId === requestedOrganizationId) && (!examId || assignment.examId === examId);
    }).map((assignment) => {
      const candidate = store.candidates.find((item) => item.id === assignment.candidateId);
      const exam = store.exams.find((item) => item.id === assignment.examId);
      return { ...assignment, candidateName: candidate?.name ?? "응시자", candidateEmail: candidate?.email ?? "", examTitle: exam?.title ?? "시험", organizationId: candidate?.organizationId };
    });
    response.json(rows);
  });
  app.get("/api/manager/exams/:examId/results/:candidateId", authenticate, requireManager, (request, response) => {
    const organizationIds = managerOrganizationIds(request.user, store.organizations);
    const exam = store.exams.find((item) => item.id === request.params.examId && organizationIds.includes(item.organizationId));
    const candidate = store.candidates.find((item) => item.id === request.params.candidateId && item.organizationId === exam?.organizationId);
    const assignment = store.assignments.find((item) => item.examId === exam?.id && item.candidateId === candidate?.id);
    if (!exam || !candidate || !assignment) return response.status(404).json({ message: "조회할 응시자 결과를 찾을 수 없습니다." });
    const submission = store.codingSubmissions.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
    const examinee = store.examinees.find((item) => item.examId === exam.id && item.candidateId === candidate.id);
    const warnings = store.warnings.filter((item) => item.examId === exam.id && item.examineeId === examinee?.id).map((warning) => ({ message: warning.message, createdAt: warning.createdAt }));
    const questions = store.questions.filter((item) => item.examId === exam.id && item.type === "CODING").map((question) => ({ id: question.id, title: question.title, languages: question.languages ?? [] }));
    return response.json({
      candidate: { id: candidate.id, name: candidate.name, email: candidate.email, candidateNumber: candidate.candidateNumber },
      exam: { id: exam.id, title: exam.title },
      result: { status: assignment.status, score: assignment.score ?? null, resultStatus: assignment.resultStatus ?? "NOT_SUBMITTED", submittedAt: assignment.submittedAt ?? null, reviewStatus: assignment.reviewStatus ?? "NOT_REVIEWED", reviewNote: assignment.reviewNote ?? "", reviewedAt: assignment.reviewedAt ?? null },
      codingSubmission: submission ? { answers: submission.answers, runResults: submission.runResults, status: submission.status, submittedAt: submission.submittedAt, updatedAt: submission.updatedAt } : null,
      questions,
      warnings
    });
  });
  app.patch("/api/manager/exams/:examId/results/:candidateId/review", authenticate, requireManager, async (request, response, next) => {
    try {
      const organizationIds = managerOrganizationIds(request.user, store.organizations);
      const exam = store.exams.find((item) => item.id === request.params.examId && organizationIds.includes(item.organizationId));
      const assignment = store.assignments.find((item) => item.examId === exam?.id && item.candidateId === request.params.candidateId);
      const reviewStatus = typeof request.body.reviewStatus === "string" ? request.body.reviewStatus : "";
      const reviewNote = typeof request.body.reviewNote === "string" ? request.body.reviewNote.trim().slice(0, 2000) : "";
      if (!exam || !assignment) return response.status(404).json({ message: "검토할 응시자 결과를 찾을 수 없습니다." });
      if (!["NOT_REVIEWED", "NORMAL", "REVIEW_REQUIRED", "SUSPICIOUS"].includes(reviewStatus)) return response.status(400).json({ message: "검토 상태가 올바르지 않습니다." });
      const result = await store.updateAssignment(assignment.id, { reviewStatus, reviewNote, reviewedAt: new Date().toISOString(), reviewedBy: request.user.id });
      return response.json({ reviewStatus: result.reviewStatus, reviewNote: result.reviewNote, reviewedAt: result.reviewedAt });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    const statusCode = error instanceof SyntaxError && error.status === 400 ? 400 : Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
    const message = statusCode === 500 ? "서버 오류가 발생했습니다." : typeof error?.message === "string" ? error.message : "요청을 처리하지 못했습니다.";
    response.status(statusCode).json({ message });
  });
  return app;
};
