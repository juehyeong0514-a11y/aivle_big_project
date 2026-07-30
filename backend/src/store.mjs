import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { seedData } from "./seed.mjs";

const scrypt = promisify(scryptCallback);

const clone = (value) => structuredClone(value);

const collectionDefaults = {
  organizations: [],
  candidates: [],
  questions: [],
  assignments: [],
  codingSubmissions: [],
  communityPosts: [],
  communityComments: [],
  invitations: [],
  invitationAuditLogs: [],
  warnings: [],
  auxiliaryDevices: [],
  idCardScans: [],
  organizationJoinRequests: [],
  sessions: [],
  emailVerifications: [],
  aiGradingRequests: [],
  organizationAiPolicies: {},
  systemPolicies: {
    invitationExpiryHours: 24,
    invitationSecurity: {
      maxVerificationAttempts: 5,
      verificationLockoutMinutes: 15,
      applicantSessionMinutes: 240,
      reverificationCooldownMinutes: 0
    },
    aiAnalysisEnabled: true,
    aiProvider: "OpenAI",
    aiModel: "gpt-4o-mini",
    cheatDetection: {
      gazeWarningEnabled: true,
      audioDetectionEnabled: true,
      tabSwitchSubmitEnabled: true
    }
  }
};

const defaultExamPolicies = (systemPolicies) => clone({ invitationExpiryHours: systemPolicies.invitationExpiryHours, aiAnalysisEnabled: systemPolicies.aiAnalysisEnabled, cheatDetection: systemPolicies.cheatDetection });

const withDefaults = (value) => ({
  ...value,
  ...Object.fromEntries(Object.entries(collectionDefaults).map(([key, fallback]) => [key, value[key] ?? clone(seedData[key] ?? fallback)]))
});

const hashPassword = async (password) => {
  const salt = randomUUID();
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
};

export const verifyPassword = async (password, passwordHash) => {
  const [salt, storedHash] = passwordHash.split(":");
  const derivedKey = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(derivedKey));
};

const normalizeSeed = async () => ({
  ...withDefaults(clone(seedData)),
  users: await Promise.all(seedData.users.map(async ({ password, ...user }) => ({
    ...user,
    passwordHash: await hashPassword(password)
  })))
});

export const createStore = async (filePath) => {
  let data;
  let shouldSave = false;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  let pool;
  if (databaseUrl) {
    try {
      const { default: pg } = await import("pg");
      pool = new pg.Pool({ connectionString: databaseUrl });
    } catch (error) {
      if (error?.code === "ERR_MODULE_NOT_FOUND") throw new Error("DATABASE_URL이 설정되어 있어 PostgreSQL 드라이버(pg)가 필요합니다. backend에서 npm ci를 실행해주세요.");
      throw error;
    }
  }

  let databaseData;

  if (pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id SMALLINT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      "SELECT data FROM app_state WHERE id = 1"
    );

    if (result.rowCount > 0) {
      databaseData = result.rows[0].data;
    } else {
      databaseData = await normalizeSeed();

      await pool.query(
        `INSERT INTO app_state (id, data)
         VALUES (1, $1::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(databaseData)]
      );
    }
  }

  try {
    data = withDefaults(
      pool
        ? databaseData
        : JSON.parse(await readFile(filePath, "utf8"))
    );
    const normalizedPolicies = { ...collectionDefaults.systemPolicies, ...data.systemPolicies, cheatDetection: { ...collectionDefaults.systemPolicies.cheatDetection, ...(data.systemPolicies.cheatDetection ?? {}) }, invitationSecurity: { ...collectionDefaults.systemPolicies.invitationSecurity, ...(data.systemPolicies.invitationSecurity ?? {}) } };
    if (JSON.stringify(normalizedPolicies) !== JSON.stringify(data.systemPolicies)) {
      data = { ...data, systemPolicies: normalizedPolicies };
      shouldSave = true;
    }
    const examsWithPolicies = data.exams.map((exam) => ({ ...exam, examPolicies: { ...defaultExamPolicies(data.systemPolicies), ...(exam.examPolicies ?? {}), cheatDetection: { ...data.systemPolicies.cheatDetection, ...(exam.examPolicies?.cheatDetection ?? {}) } } }));
    if (examsWithPolicies.some((exam, index) => JSON.stringify(exam.examPolicies) !== JSON.stringify(data.exams[index].examPolicies))) { data = { ...data, exams: examsWithPolicies }; shouldSave = true; }
    const validSessions = data.sessions.filter((session) => new Date(session.expiresAt) > new Date());
    if (validSessions.length !== data.sessions.length) {
      data = { ...data, sessions: validSessions };
      shouldSave = true;
    }
    const migratedExams = data.exams.map((exam) => exam.id === "exam-2026-second-half" && !exam.organizationId ? { ...exam, organizationId: "org-aivle-cs" } : exam);
    if (migratedExams.some((exam, index) => exam.organizationId !== data.exams[index].organizationId)) {
      data = { ...data, exams: migratedExams };
      shouldSave = true;
    }
    const migratedInvitations = data.invitations.map(({ token, ...invitation }) => token ? { ...invitation, tokenHash: createHash("sha256").update(token).digest("hex") } : invitation);
    if (migratedInvitations.some((invitation, index) => invitation.tokenHash !== data.invitations[index].tokenHash || Object.hasOwn(data.invitations[index], "token"))) {
      data = { ...data, invitations: migratedInvitations };
      shouldSave = true;
    }
    const migratedInvitationUses = data.invitations.map(({ usedAt, ...invitation }) => usedAt ? { ...invitation, verifiedAt: invitation.verifiedAt ?? usedAt } : invitation);
    if (migratedInvitationUses.some((invitation, index) => Object.hasOwn(data.invitations[index], "usedAt") || invitation.verifiedAt !== data.invitations[index].verifiedAt)) {
      data = { ...data, invitations: migratedInvitationUses };
      shouldSave = true;
    }
    if (data.questions.length === 0 && data.exams.some((exam) => exam.id === "exam-2026-second-half")) {
      data = { ...data, questions: clone(seedData.questions) };
      shouldSave = true;
    }
    const legacyDemoQuestion = data.questions.find((question) => question.examId === "exam-2026-second-half" && question.type === "CODING" && question.title === "123");
    const seededDemoQuestions = seedData.questions.filter((question) => question.id === "coding-example-1" || question.id === "coding-example-2");
    if (legacyDemoQuestion && !seededDemoQuestions.every((demo) => data.questions.some((question) => question.id === demo.id))) {
      data = {
        ...data,
        questions: [
          ...data.questions.filter((question) => question.id !== legacyDemoQuestion.id && !seededDemoQuestions.some((demo) => demo.id === question.id)),
          ...clone(seededDemoQuestions)
        ]
      };
      shouldSave = true;
    }
    const migratedUsers = data.users.map((user) => user.role === "SUPERVISOR" ? { ...user, role: "MANAGER", name: user.name === "감독관" ? "김관리자" : user.name, organizationIds: user.organizationIds ?? data.organizations.filter((organization) => organization.managerIds?.includes(user.id)).map((organization) => organization.id) } : user);
    if (migratedUsers.some((user, index) => user.role !== data.users[index].role || user.name !== data.users[index].name)) {
      data = { ...data, users: migratedUsers };
      shouldSave = true;
    }
    const migratedExaminees = data.examinees.map((examinee, index) => examinee.organizationId ? examinee : { ...examinee, organizationId: index < 2 ? "org-aivle-cs" : "org-data-lab" });
    const migratedExamineesWithExam = migratedExaminees.map((examinee) => {
      if (examinee.examId) return examinee;
      const exam = data.exams.find((candidate) => candidate.organizationId === examinee.organizationId);
      return exam ? { ...examinee, examId: exam.id } : examinee;
    });
    if (migratedExamineesWithExam.some((examinee, index) => examinee.organizationId !== data.examinees[index].organizationId || examinee.examId !== data.examinees[index].examId)) {
      data = { ...data, examinees: migratedExamineesWithExam };
      shouldSave = true;
    }
    if (data.users.some((user) => Object.hasOwn(user, "password"))) {
      data = {
        ...data,
        users: data.users.map(({ password, ...user }) => user)
      };
      shouldSave = true;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    data = await normalizeSeed();
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

const save = async () => {
  if (pool) {
    await pool.query(
      `INSERT INTO app_state (id, data, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = NOW()`,
      [JSON.stringify(data)]
    );
    return;
  }

  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(data, null, 2));
  await rename(temporaryPath, filePath);
};

  let saveQueue = Promise.resolve();
  const queuedSave = () => {
    saveQueue = saveQueue.then(save);
    return saveQueue;
  };

  if (shouldSave) await save();

  return {
    get users() { return data.users; },
    get exams() { return data.exams; },
    get notices() { return data.notices; },
    get communityPosts() { return data.communityPosts; },
    get communityComments() { return data.communityComments; },
    get warnings() { return data.warnings; },
    get auxiliaryDevices() { return data.auxiliaryDevices; },
    get idCardScans() { return data.idCardScans; },
    get examinees() { return data.examinees; },
    get organizations() { return data.organizations; },
    get candidates() { return data.candidates; },
    get questions() { return data.questions; },
    get assignments() { return data.assignments; },
    get codingSubmissions() { return data.codingSubmissions; },
    get invitations() { return data.invitations; },
    get invitationAuditLogs() { return data.invitationAuditLogs; },
    get organizationJoinRequests() { return data.organizationJoinRequests; },
    get sessions() { return data.sessions; },
    get emailVerifications() { return data.emailVerifications; },
    get aiGradingRequests() { return data.aiGradingRequests; },
    get organizationAiPolicies() { return data.organizationAiPolicies; },
    get systemPolicies() { return data.systemPolicies; },
    updateSystemPolicies: async (patch) => {
      data.systemPolicies = { ...data.systemPolicies, ...patch };
      await queuedSave();
      return data.systemPolicies;
    },
    updateOrganizationAiPolicies: async (policies) => {
      data.organizationAiPolicies = clone(policies);
      await queuedSave();
      return data.organizationAiPolicies;
    },
    addAiGradingRequest: async (request) => {
      data.aiGradingRequests.unshift(request);
      await queuedSave();
      return request;
    },
    updateAiGradingRequest: async (id, patch) => {
      const request = data.aiGradingRequests.find((item) => item.id === id);
      if (!request) return undefined;
      Object.assign(request, patch);
      await queuedSave();
      return request;
    },
    consumeOrganizationAiQuota: async (organizationId, usageMonth) => {
      const policy = data.organizationAiPolicies[organizationId];
      if (!policy?.enabled) return { allowed: false, reason: "ORGANIZATION_AI_DISABLED" };
      const monthlyUsage = policy.usageMonth === usageMonth ? policy.monthlyUsage : 0;
      if (monthlyUsage >= policy.monthlyLimit) return { allowed: false, reason: "MONTHLY_AI_LIMIT_EXCEEDED" };
      data.organizationAiPolicies[organizationId] = { ...policy, monthlyUsage: monthlyUsage + 1, usageMonth };
      await queuedSave();
      return { allowed: true, policy: clone(data.organizationAiPolicies[organizationId]) };
    },
    addUser: async ({ password, ...user }) => {
      data.users.push({ ...user, passwordHash: await hashPassword(password) });
      await queuedSave();
    },
    addExam: async (exam) => {
      data.exams.unshift({ ...exam, examPolicies: exam.examPolicies ?? defaultExamPolicies(data.systemPolicies) });
      await queuedSave();
    },
    updateExam: async (id, patch) => {
      const exam = data.exams.find((candidate) => candidate.id === id);
      if (!exam) return undefined;
      Object.assign(exam, patch);
      await queuedSave();
      return exam;
    },
    addWarning: async (warning) => {
      data.warnings.push(warning);
      await queuedSave();
    },
    addAuxiliaryDevice: async (device) => {
      data.auxiliaryDevices = data.auxiliaryDevices.filter((item) => item.expiresAt > Date.now());
      data.auxiliaryDevices.push(device);
      await queuedSave();
      return device;
    },
    updateAuxiliaryDevice: async (token, patch) => {
      const device = data.auxiliaryDevices.find((item) => item.token === token);
      if (!device) return undefined;
      Object.assign(device, patch);
      await queuedSave();
      return device;
    },
    addIdCardScan: async (scan) => {
      data.idCardScans = data.idCardScans.filter((item) => item.expiresAt > Date.now());
      data.idCardScans.push(scan);
      await queuedSave();
      return scan;
    },
    updateIdCardScan: async (token, patch) => {
      const scan = data.idCardScans.find((item) => item.token === token);
      if (!scan) return undefined;
      Object.assign(scan, patch);
      await queuedSave();
      return scan;
    },
    removeAuxiliaryDevices: async (examId, candidateId) => {
      data.auxiliaryDevices = data.auxiliaryDevices.filter((item) => item.examId !== examId || item.candidateId !== candidateId);
      await queuedSave();
    },
    addNotice: async (notice) => {
      data.notices.unshift(notice);
      await queuedSave();
      return notice;
    },
    updateNotice: async (id, patch) => {
      const notice = data.notices.find((item) => item.id === id);
      if (!notice) return undefined;
      Object.assign(notice, patch);
      await queuedSave();
      return notice;
    },
    removeNotice: async (id) => {
      const index = data.notices.findIndex((item) => item.id === id);
      if (index < 0) return undefined;
      const [removed] = data.notices.splice(index, 1);
      await queuedSave();
      return removed;
    },
    addCommunityPost: async (post) => {
      data.communityPosts.unshift(post);
      await queuedSave();
      return post;
    },
    updateCommunityPost: async (id, patch) => {
      const post = data.communityPosts.find((item) => item.id === id);
      if (!post) return undefined;
      Object.assign(post, patch);
      await queuedSave();
      return post;
    },
    removeCommunityPost: async (id) => {
      const index = data.communityPosts.findIndex((item) => item.id === id);
      if (index < 0) return undefined;
      const [removed] = data.communityPosts.splice(index, 1);
      data.communityComments = data.communityComments.filter((item) => item.postId !== id);
      await queuedSave();
      return removed;
    },
    addCommunityComment: async (comment) => {
      data.communityComments.push(comment);
      await queuedSave();
      return comment;
    },
    updateCommunityComment: async (id, patch) => {
      const comment = data.communityComments.find((item) => item.id === id);
      if (!comment) return undefined;
      Object.assign(comment, patch);
      await queuedSave();
      return comment;
    },
    removeCommunityComment: async (id) => {
      const index = data.communityComments.findIndex((item) => item.id === id);
      if (index < 0) return undefined;
      const [removed] = data.communityComments.splice(index, 1);
      await queuedSave();
      return removed;
    },
    addOrganization: async (organization) => {
      data.organizations.unshift(organization);
      await queuedSave();
    },
    updateOrganization: async (id, patch) => {
      const organization = data.organizations.find((candidate) => candidate.id === id);
      if (!organization) return undefined;
      Object.assign(organization, patch);
      await queuedSave();
      return organization;
    },
    updateUser: async (id, patch) => {
      const user = data.users.find((candidate) => candidate.id === id);
      if (!user) return undefined;
      Object.assign(user, patch);
      await queuedSave();
      return user;
    },
    addCandidate: async (candidate) => {
      data.candidates.push(candidate);
      await queuedSave();
    },
    updateCandidate: async (id, patch) => {
      const candidate = data.candidates.find((item) => item.id === id);
      if (!candidate) return undefined;
      Object.assign(candidate, patch);
      await queuedSave();
      return candidate;
    },
    addExaminee: async (examinee) => {
      data.examinees.push(examinee);
      await queuedSave();
    },
    updateExaminee: async (id, patch) => {
      const examinee = data.examinees.find((candidate) => candidate.id === id);
      if (!examinee) return undefined;
      Object.assign(examinee, patch);
      await queuedSave();
      return examinee;
    },
    addQuestion: async (question) => {
      data.questions.push(question);
      await queuedSave();
    },
    updateQuestion: async (id, patch) => {
      const question = data.questions.find((candidate) => candidate.id === id);
      if (!question) return undefined;
      Object.assign(question, patch);
      await queuedSave();
      return question;
    },
    removeQuestion: async (id) => {
      const questionIndex = data.questions.findIndex((question) => question.id === id);
      if (questionIndex < 0) return false;
      data.questions.splice(questionIndex, 1);
      await queuedSave();
      return true;
    },
    addAssignment: async (assignment) => {
      data.assignments.push(assignment);
      await queuedSave();
    },
    removeExamAssignments: async (examId, candidateIds) => {
      const candidateIdSet = new Set(candidateIds);
      const assignmentIds = new Set(data.assignments
        .filter((assignment) => assignment.examId === examId && candidateIdSet.has(assignment.candidateId))
        .map((assignment) => assignment.id));
      const examineeIds = new Set(data.examinees
        .filter((examinee) => examinee.examId === examId && candidateIdSet.has(examinee.candidateId))
        .map((examinee) => examinee.id));
      data.assignments = data.assignments.filter((assignment) => !assignmentIds.has(assignment.id));
      data.codingSubmissions = data.codingSubmissions.filter((submission) => !(submission.examId === examId && candidateIdSet.has(submission.candidateId)));
      data.invitations = data.invitations.filter((invitation) => !(invitation.examId === examId && candidateIdSet.has(invitation.candidateId)));
      data.examinees = data.examinees.filter((examinee) => !examineeIds.has(examinee.id));
      data.warnings = data.warnings.filter((warning) => !examineeIds.has(warning.examineeId));
      await queuedSave();
      return { assignmentIds, examineeIds };
    },
    updateAssignment: async (id, patch) => {
      const assignment = data.assignments.find((candidate) => candidate.id === id);
      if (!assignment) return undefined;
      Object.assign(assignment, patch);
      await queuedSave();
      return assignment;
    },
    saveCodingSubmission: async (submission) => {
      const existing = data.codingSubmissions.find((candidate) => candidate.examId === submission.examId && candidate.candidateId === submission.candidateId);
      if (existing) Object.assign(existing, submission);
      else data.codingSubmissions.push(submission);
      await queuedSave();
      return existing ?? submission;
    },
    addInvitation: async (invitation) => {
      data.invitations.unshift(invitation);
      await queuedSave();
    },
    updateInvitation: async (id, patch) => {
      const invitation = data.invitations.find((candidate) => candidate.id === id);
      if (!invitation) return undefined;
      Object.assign(invitation, patch);
      await queuedSave();
      return invitation;
    },
    addInvitationAuditLog: async (auditLog) => {
      data.invitationAuditLogs.unshift(auditLog);
      await queuedSave();
      return auditLog;
    },
    addOrganizationJoinRequest: async (request) => {
      data.organizationJoinRequests.unshift(request);
      await queuedSave();
    },
    updateOrganizationJoinRequest: async (id, patch) => {
      const request = data.organizationJoinRequests.find((candidate) => candidate.id === id);
      if (!request) return undefined;
      Object.assign(request, patch);
      await queuedSave();
      return request;
    },
    addSession: async (session) => {
      data.sessions.push(session);
      await queuedSave();
    },
    addEmailVerification: async (verification) => {
      data.emailVerifications = data.emailVerifications.filter((item) => item.email !== verification.email || item.verifiedAt);
      data.emailVerifications.push(verification);
      await queuedSave();
    },
    updateEmailVerification: async (id, patch) => {
      const verification = data.emailVerifications.find((item) => item.id === id);
      if (!verification) return undefined;
      Object.assign(verification, patch);
      await queuedSave();
      return verification;
    },
    removeSession: async (tokenHash) => {
      data.sessions = data.sessions.filter((session) => session.tokenHash !== tokenHash);
      await queuedSave();
    }
  };
};
