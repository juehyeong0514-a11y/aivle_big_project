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
  invitations: [],
  warnings: [],
  organizationJoinRequests: [],
  sessions: [],
  emailVerifications: [],
  systemPolicies: {
    invitationExpiryHours: 24,
    aiAnalysisEnabled: true,
    cheatDetection: {
      gazeWarningEnabled: true,
      audioDetectionEnabled: true,
      tabSwitchSubmitEnabled: true
    }
  }
};

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
  try {
    data = withDefaults(JSON.parse(await readFile(filePath, "utf8")));
    const normalizedPolicies = { ...collectionDefaults.systemPolicies, ...data.systemPolicies, cheatDetection: { ...collectionDefaults.systemPolicies.cheatDetection, ...(data.systemPolicies.cheatDetection ?? {}) } };
    if (JSON.stringify(normalizedPolicies) !== JSON.stringify(data.systemPolicies)) {
      data = { ...data, systemPolicies: normalizedPolicies };
      shouldSave = true;
    }
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
    if (data.questions.length === 0 && data.exams.some((exam) => exam.id === "exam-2026-second-half")) {
      data = { ...data, questions: clone(seedData.questions) };
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
    get warnings() { return data.warnings; },
    get examinees() { return data.examinees; },
    get organizations() { return data.organizations; },
    get candidates() { return data.candidates; },
    get questions() { return data.questions; },
    get assignments() { return data.assignments; },
    get invitations() { return data.invitations; },
    get organizationJoinRequests() { return data.organizationJoinRequests; },
    get sessions() { return data.sessions; },
    get emailVerifications() { return data.emailVerifications; },
    get systemPolicies() { return data.systemPolicies; },
    updateSystemPolicies: async (patch) => {
      data.systemPolicies = { ...data.systemPolicies, ...patch };
      await queuedSave();
      return data.systemPolicies;
    },
    addUser: async ({ password, ...user }) => {
      data.users.push({ ...user, passwordHash: await hashPassword(password) });
      await queuedSave();
    },
    addExam: async (exam) => {
      data.exams.unshift(exam);
      await queuedSave();
    },
    addWarning: async (warning) => {
      data.warnings.push(warning);
      await queuedSave();
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
