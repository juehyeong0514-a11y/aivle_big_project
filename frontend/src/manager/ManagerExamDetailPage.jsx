import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  Clock,
  Copy,
  Eye,
  ExternalLink,
  FileUp,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage, authHeaders } from "../api/client";
import { automationPhaseFor, formatAutomationLeadTime, formatAutomationScheduledAt, localizeAutomationExclusionReason, localizeAutomationFailure } from "../automationUi.mjs";
import { getExamCandidateScope } from "./candidateScope.mjs";
import {
  codingDraftKey,
  hasMeaningfulAssistantRequirements,
  hasMeaningfulCodingDraft,
  parseCodingDraft,
  serializeCodingDraft,
  validateCodingProblem,
} from "./codingProblemWorkflow.mjs";
import ProblemCreationChatbot from "./ProblemCreationChatbot.jsx";
import { candidateToProblem } from "./problemChatbotWorkflow.mjs";
import { generateProblemCandidates } from "./problemCandidateService.mjs";
import { formatScheduleForApi } from "./examSchedule.mjs";

const initialCodingProblem = () => ({
  title: "",
  languages: ["Python", "Java", "C", "JavaScript"],
  description: "",
  inputFormat: "",
  outputFormat: "",
  constraints: "",
  publicExamples: [{ input: "", expectedOutput: "", explanation: "" }],
  hiddenTestCases: [{ input: "", expectedOutput: "" }],
  judgeMode: "EXACT",
  numericTolerance: 0,
  customJudgeCode: "",
  aiAnalysis: {
    enabled: true,
    rubrics: [],
    customRubrics: [],
    customRubricsEnabled: false,
    customRubricDraft: "",
    mistakePatterns: [],
    customMistakes: [],
    customMistakesEnabled: false,
    customMistakeDraft: "",
    algorithmRequirements: [],
    recommendedAlgorithms: [],
    customAlgorithms: [],
    customAlgorithmsEnabled: false,
    customAlgorithmDraft: "",
    expectedTimeComplexity: "",
    expectedSpaceComplexity: "",
    solutionRequirements: "",
    prohibitedApproaches: "",
    learningMaterials: [{ title: "", url: "" }],
    referenceMaterials: [],
    referenceAnswer: {
      status: "NOT_RUN",
      generatedAt: "",
      feasibilityMessage: "",
      errorMessage: "",
      errorDetail: "",
      errorCode: "",
      providerStatus: undefined,
      warnings: [],
      provider: "",
      model: "",
    },
    validation: {
      sampleCount: 10,
      language: "Python",
      status: "NOT_RUN",
      samples: [],
      generatedAt: "",
    },
  },
  referenceSolutions: { Python: "", Java: "", C: "", JavaScript: "" },
});
const initialMultipleChoiceQuestion = () => ({ prompt: "", options: ["", ""], answer: "" });
const normalizeCustomTextItems = (value) => {
  const items = Array.isArray(value) ? value : [value];
  return items.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
};
const hasCustomItems = (value) => Array.isArray(value) ? value.length > 0 : Boolean(value);
const normalizeCustomAlgorithmItems = (value, fallbackLevel = "RECOMMENDED") => {
  const items = Array.isArray(value) ? value : (typeof value === "string" ? [{ name: value, level: fallbackLevel }] : []);
  return items.map((item) => ({
    name: typeof item === "string" ? item.trim() : (typeof item?.name === "string" ? item.name.trim() : ""),
    level: (typeof item?.level === "string" ? item.level : fallbackLevel) === "REQUIRED" ? "REQUIRED" : "RECOMMENDED",
  })).filter((item) => item.name || Array.isArray(value));
};
const normalizeLearningMaterials = (value) => {
  const materials = Array.isArray(value) ? value : [];
  const committed = materials
    .map((material) => ({ title: "", url: "", ...(material ?? {}) }))
    .filter((material) => String(material.title ?? "").trim() || String(material.url ?? "").trim());
  return [...committed, { title: "", url: "" }];
};
const normalizeAiValidation = (value) => {
  const sampleCount = Number(value?.sampleCount) === 5 ? 5 : 10;
  const status = ["NOT_RUN", "PROCESSING", "GENERATED", "FAILED"].includes(value?.status) ? value.status : "NOT_RUN";
  const samples = Array.isArray(value?.samples)
    ? value.samples.map((sample) => ({
      id: typeof sample?.id === "string" ? sample.id : "",
      kind: typeof sample?.kind === "string" ? sample.kind : "",
      summary: typeof sample?.summary === "string" ? sample.summary : "",
      expectedIssue: typeof sample?.expectedIssue === "string" ? sample.expectedIssue : "",
      language: typeof sample?.language === "string" ? sample.language : "Python",
      source: typeof sample?.source === "string" ? sample.source : "",
    })).filter((sample) => sample.source).slice(0, 10)
    : [];
  return {
    sampleCount,
    language: typeof value?.language === "string" ? value.language : "Python",
    status,
    samples,
    generatedAt: typeof value?.generatedAt === "string" ? value.generatedAt : "",
  };
};
const normalizeAiReferenceAnswer = (value) => ({
  status: ["NOT_RUN", "PROCESSING", "GENERATED", "BLOCKED", "FAILED"].includes(value?.status) ? value.status : "NOT_RUN",
  generatedAt: typeof value?.generatedAt === "string" ? value.generatedAt : "",
  feasibilityMessage: typeof value?.feasibilityMessage === "string" ? value.feasibilityMessage : "",
  errorMessage: typeof value?.errorMessage === "string" ? value.errorMessage : "",
  errorDetail: typeof value?.errorDetail === "string" ? value.errorDetail : "",
  errorCode: typeof value?.errorCode === "string" ? value.errorCode : "",
  providerStatus: Number.isInteger(Number(value?.providerStatus)) ? Number(value.providerStatus) : undefined,
  warnings: Array.isArray(value?.warnings) ? value.warnings.filter((item) => typeof item === "string") : [],
  provider: typeof value?.provider === "string" ? value.provider : "",
  model: typeof value?.model === "string" ? value.model : "",
});
const questionToForm = (question) => ({
  ...initialCodingProblem(),
  ...question,
  publicExamples: question.publicExamples?.map((example) => ({
    ...example,
  })) ?? [{ input: "", expectedOutput: "", explanation: "" }],
  hiddenTestCases: question.hiddenTestCases?.map((testCase) => ({
    ...testCase,
  })) ?? [{ input: "", expectedOutput: "" }],
  referenceSolutions: {
    Python: "",
    Java: "",
    C: "",
    JavaScript: "",
    ...(question.referenceSolutions ?? {}),
  },
  aiAnalysis: {
    ...initialCodingProblem().aiAnalysis,
    ...(question.aiAnalysis ?? {}),
    algorithmRequirements: Array.isArray(question.aiAnalysis?.algorithmRequirements)
      ? question.aiAnalysis.algorithmRequirements
      : (question.aiAnalysis?.recommendedAlgorithms ?? []).map((algorithm) => ({ algorithm, level: "RECOMMENDED" })),
    customRubrics: normalizeCustomTextItems(question.aiAnalysis?.customRubrics),
    customRubricsEnabled: question.aiAnalysis?.customRubricsEnabled ?? hasCustomItems(question.aiAnalysis?.customRubrics),
    customRubricDraft: "",
    customMistakes: normalizeCustomTextItems(question.aiAnalysis?.customMistakes),
    customMistakesEnabled: question.aiAnalysis?.customMistakesEnabled ?? hasCustomItems(question.aiAnalysis?.customMistakes),
    customMistakeDraft: "",
    customAlgorithms: normalizeCustomAlgorithmItems(question.aiAnalysis?.customAlgorithms, question.aiAnalysis?.customAlgorithmLevel),
    customAlgorithmsEnabled: question.aiAnalysis?.customAlgorithmsEnabled ?? hasCustomItems(question.aiAnalysis?.customAlgorithms),
    customAlgorithmDraft: "",
    learningMaterials: normalizeLearningMaterials(question.aiAnalysis?.learningMaterials),
    referenceMaterials: question.aiAnalysis?.referenceMaterials ?? [],
    referenceAnswer: normalizeAiReferenceAnswer(question.aiAnalysis?.referenceAnswer),
    validation: normalizeAiValidation(question.aiAnalysis?.validation),
  },
});

const normalizeBirthDate = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  if (digits.length === 6) {
    const year = Number(digits.slice(0, 2));
    const currentYear = new Date().getFullYear() % 100;
    const century = year <= currentYear ? "20" : "19";
    return `${century}${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  }
  return String(value ?? "").trim();
};
const isValidCsvBirthDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const parseCandidateCsv = (source) => {
  const rows = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (rows.length < 2) throw new Error("제목 행과 응시자 정보를 포함한 CSV 파일을 올려주세요.");
  const delimiter = rows[0].includes("\t") ? "\t" : ",";
  const headers = rows[0].split(delimiter).map((value) => value.trim().toLowerCase().replace(/\s/g, ""));
  const fieldIndex = (aliases) => headers.findIndex((header) => aliases.includes(header));
  const nameIndex = fieldIndex(["name", "이름", "성명"]);
  const emailIndex = fieldIndex(["email", "이메일"]);
  const birthDateIndex = fieldIndex(["birthdate", "birth_date", "dob", "생년월일"]);
  if ([nameIndex, emailIndex, birthDateIndex].some((index) => index < 0)) throw new Error("CSV 첫 줄에 이름, 이메일, 생년월일 열이 필요합니다.");
  const candidates = rows.slice(1).map((row) => {
    const values = row.split(delimiter).map((value) => value.trim());
    return { name: values[nameIndex], email: values[emailIndex], birthDate: normalizeBirthDate(values[birthDateIndex]) };
  });
  const invalidRow = candidates.findIndex((candidate) => !candidate.name || !candidate.email || !isValidCsvBirthDate(candidate.birthDate));
  if (invalidRow >= 0) throw new Error(`CSV ${invalidRow + 2}행을 확인해 주세요. 이름, 이메일, 생년월일이 모두 필요합니다.`);
  return candidates;
};

const AUTOMATION_LOCKED_PHASES = new Set([
  "INVITING",
  "FINALIZING",
  "GRADING",
  "REPORTING",
  "EMAIL_SENDING",
]);

const AUTOMATION_RETRYABLE_PHASES = new Set([
  "FAILED",
  "INVITATION_FAILED",
  "GRADING_FAILED",
  "EMAIL_FAILED",
]);

const previewExclusionReasonLabels = new Map([
  ["DUPLICATE_CANDIDATE", "중복된 응시자 항목입니다."],
  ["ORGANIZATION_MISMATCH", "현재 시험 조직과 다른 응시자입니다."],
  ["STATUS_NOT_REGISTERED", "등록 완료 상태의 응시자만 운영 대상에 포함됩니다."],
  ["TEST_CANDIDATE", "테스트 계정은 자동 운영 대상에서 제외됩니다."],
  ["INVALID_EMAIL", "이메일 형식이 올바르지 않습니다."],
  ["DUPLICATE_EMAIL", "동일한 이메일이 중복 등록되어 있습니다."],
  ["MISSING_BIRTH_DATE", "생년월일이 없거나 형식이 올바르지 않습니다."],
]);

const localizePreviewExclusionReason = (value) => {
  const key = typeof value === "string" ? value.trim().toUpperCase() : "";
  return previewExclusionReasonLabels.get(key) || localizeAutomationExclusionReason(key);
};

const normalizeInviteLeadDraft = (value) => {
  const nextValue = Number(String(value ?? "").trim());
  if (!Number.isInteger(nextValue) || nextValue < 0 || nextValue > 10_080) {
    throw new Error("초대 발송 시점은 0분부터 10,080분(7일)까지 정수로 입력해 주세요.");
  }
  return nextValue;
};

const computeExpectedInvitationAt = (startsAt, leadMinutes) => {
  const rawStart = String(startsAt ?? "").trim();
  const localStart = rawStart.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})[T\s](\d{1,2}):(\d{2})$/);
  const startAtMs = localStart
    ? new Date(Number(localStart[1]), Number(localStart[2]) - 1, Number(localStart[3]), Number(localStart[4]), Number(localStart[5])).getTime()
    : Date.parse(rawStart);
  const leadMinutesValue = Number(String(leadMinutes ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(startAtMs) || !Number.isFinite(leadMinutesValue)) return null;
  return new Date(startAtMs - Math.max(0, leadMinutesValue) * 60_000).toISOString();
};

const scheduleInputValue = (value) => {
  const rawValue = String(value ?? "").trim();
  const localValue = rawValue.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})[T\s](\d{1,2}):(\d{2})/);
  if (localValue) return `${localValue[1]}-${localValue[2].padStart(2, "0")}-${localValue[3].padStart(2, "0")}T${localValue[4].padStart(2, "0")}:${localValue[5]}`;
  const timestamp = Date.parse(rawValue);
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ManagerExamDetailPage() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [organizationCandidates, setOrganizationCandidates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [assignedCandidateIds, setAssignedCandidateIds] = useState([]);
  const [invitedCandidateIds, setInvitedCandidateIds] = useState([]);
  const [questionForm, setQuestionForm] = useState(initialCodingProblem);
  const [multipleChoiceForm, setMultipleChoiceForm] = useState(initialMultipleChoiceQuestion);
  const [questionType, setQuestionType] = useState("CODING");
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [candidateForm, setCandidateForm] = useState({ name: "", email: "", birthDate: "" });
  const [candidateSearch, setCandidateSearch] = useState("");
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [candidateUploadError, setCandidateUploadError] = useState("");
  const [candidateUploadPreview, setCandidateUploadPreview] = useState([]);
  const [candidateUploadFileName, setCandidateUploadFileName] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [mailPreviews, setMailPreviews] = useState([]);
  const [identityVerificationRequests, setIdentityVerificationRequests] = useState([]);
  const [reviewingIdentityRequestId, setReviewingIdentityRequestId] = useState("");
  const [copiedEntryLink, setCopiedEntryLink] = useState("");
  const [automationStatus, setAutomationStatus] = useState(null);
  const [inviteLeadDraft, setInviteLeadDraft] = useState("");
  const inviteLeadDirtyRef = useRef(false);
  const [isSavingInviteLead, setIsSavingInviteLead] = useState(false);
  const [examScheduleDraft, setExamScheduleDraft] = useState("");
  const [isSavingExamSchedule, setIsSavingExamSchedule] = useState(false);
  const [isStartingAutomation, setIsStartingAutomation] = useState(false);
  const [isRetryingAutomation, setIsRetryingAutomation] = useState(false);
  const [isUpdatingAutomationControl, setIsUpdatingAutomationControl] = useState(false);
  const [automationControlMessage, setAutomationControlMessage] = useState(null);
  const [automationConfirmOpen, setAutomationConfirmOpen] = useState(false);
  const [activeManagementPanel, setActiveManagementPanel] = useState("automation");
  const initializedManagementPanelExamId = useRef("");
  const [isExamPreviewOpen, setIsExamPreviewOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [questionToDelete, setQuestionToDelete] = useState(null);
  const [messageType, setMessageType] = useState("info");
  const [isEditingExamTitle, setIsEditingExamTitle] = useState(false);
  const [examTitleDraft, setExamTitleDraft] = useState("");
  const [isSavingExamTitle, setIsSavingExamTitle] = useState(false);
  const headers = useMemo(() => ({ headers: authHeaders() }), []);
  const uploadableCandidateCount = candidateUploadPreview.filter((candidate) => !candidate.uploadError).length;
  const uploadErrorCount = candidateUploadPreview.length - uploadableCandidateCount;

  const applyAutomationStatus = useCallback((payload, fallbackExam = null) => {
    const nextStatus = payload && typeof payload === "object" ? payload : null;
    setAutomationStatus(nextStatus);
    const nextLeadMinutes = nextStatus?.state?.inviteLeadMinutes ?? nextStatus?.exam?.inviteLeadMinutes ?? fallbackExam?.inviteLeadMinutes;
    if (!inviteLeadDirtyRef.current && nextLeadMinutes !== undefined && nextLeadMinutes !== null) setInviteLeadDraft(String(nextLeadMinutes));
    if (fallbackExam || nextStatus?.exam) {
      setExam((current) => ({ ...(current ?? {}), ...(fallbackExam ?? {}), ...(nextStatus?.exam ?? {}) }));
    }
  }, []);

  const load = useCallback(async () => {
    const [examResponse, candidateResponse, examCandidateResponse, questionResponse, invitationResponse, identityRequestResponse, automationResponse] =
      await Promise.all([
        api.get("/manager/exams", headers),
        api.get("/manager/candidates?scope=ORGANIZATION", headers),
        api.get(`/manager/exams/${examId}/candidates`, headers),
        api.get(`/manager/exams/${examId}/questions`, headers),
        api.get("/manager/invitations", headers),
        api.get(`/manager/exams/${examId}/identity-verification-requests`, headers),
        api.get(`/manager/exams/${examId}/automation-status`, headers).catch(() => ({ data: null })),
      ]);
    const selectedExam = examResponse.data.find((item) => item.id === examId) || null;
    setExam(selectedExam);
    setCandidates(examCandidateResponse.data);
    setOrganizationCandidates(candidateResponse.data);
    setQuestions(questionResponse.data);
    if (initializedManagementPanelExamId.current !== examId) {
      initializedManagementPanelExamId.current = examId;
      setActiveManagementPanel(questionResponse.data.length === 0 ? "questions" : "automation");
    }
    setIdentityVerificationRequests(identityRequestResponse.data);
    applyAutomationStatus(automationResponse.data, selectedExam);
    setAssignedCandidateIds(
      examCandidateResponse.data.map((candidate) => candidate.id),
    );
    setInvitedCandidateIds([
      ...new Set(
        invitationResponse.data
          .filter((invitation) => invitation.examId === examId && !invitation.revokedAt)
          .map((invitation) => invitation.candidateId),
      ),
    ]);
    setMailPreviews(invitationResponse.data
      .filter((invitation) => invitation.examId === examId && !invitation.revokedAt && invitation.entryLink)
      .map((invitation) => {
        const candidate = examCandidateResponse.data.find((item) => item.id === invitation.candidateId);
        return {
          entryLink: invitation.entryLink,
          to: candidate?.email ?? "이메일 미등록",
          candidateNumber: invitation.candidateNumber ?? candidate?.candidateNumber ?? "",
        };
      }));
    setSelectedCandidateIds((current) =>
      current.filter((candidateId) =>
        examCandidateResponse.data.some(
          (candidate) => candidate.id === candidateId,
        ),
      ),
    );
  }, [applyAutomationStatus, examId, headers]);

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const showAutomationMessage = (text, type = "info") => {
    setMessage("");
    setAutomationControlMessage({ type, text });
  };

  const changeInviteLeadDraft = (value) => {
    inviteLeadDirtyRef.current = true;
    setInviteLeadDraft(value);
  };

  const saveInviteLeadMinutes = async (options = {}) => {
    const { silent = false } = options;
    setIsSavingInviteLead(true);
    try {
      const value = normalizeInviteLeadDraft(inviteLeadDraft);
      const { data } = await api.patch(`/manager/exams/${examId}`, { inviteLeadMinutes: value }, headers);
      const automationResponse = await api.get(`/manager/exams/${examId}/automation-status`, headers).catch(() => ({ data: null }));
      inviteLeadDirtyRef.current = false;
      applyAutomationStatus(automationResponse.data, data);
      if (!silent) showAutomationMessage("초대 링크 발송 시점을 저장했습니다.");
      return value;
    } catch (reason) {
      const errorMessage = reason instanceof Error && !reason.response
        ? reason.message
        : apiErrorMessage(reason, "초대 링크 발송 시점을 저장하지 못했습니다.");
      showAutomationMessage(errorMessage, "error");
      throw reason;
    } finally {
      setIsSavingInviteLead(false);
    }
  };

  useEffect(() => {
    const nextSchedule = scheduleInputValue(exam?.date || automationStatus?.exam?.startsAt);
    if (nextSchedule) setExamScheduleDraft((current) => current || nextSchedule);
  }, [automationStatus?.exam?.startsAt, exam?.date]);

  const saveExamSchedule = async () => {
    const date = formatScheduleForApi(examScheduleDraft);
    if (!date) return showAutomationMessage("시험 시작 일시를 올바르게 입력해 주세요.", "error");
    setIsSavingExamSchedule(true);
    try {
      const { data } = await api.patch(`/manager/exams/${examId}`, { date }, headers);
      const automationResponse = await api.get(`/manager/exams/${examId}/automation-status`, headers).catch(() => ({ data: null }));
      applyAutomationStatus(automationResponse.data, data);
      showAutomationMessage("시험 시작 일시를 저장했습니다.");
    } catch (reason) {
      showAutomationMessage(apiErrorMessage(reason, "시험 시작 일시를 저장하지 못했습니다."), "error");
    } finally {
      setIsSavingExamSchedule(false);
    }
  };

  const startExamAutomation = async () => {
    setIsStartingAutomation(true);
    try {
      const currentLeadMinutes = Number(automationStatus?.state?.inviteLeadMinutes ?? automationStatus?.exam?.inviteLeadMinutes ?? exam?.inviteLeadMinutes);
      const nextLeadMinutes = normalizeInviteLeadDraft(inviteLeadDraft);
      if (!AUTOMATION_LOCKED_PHASES.has(String(automationStatus?.state?.phase ?? automationStatus?.state?.status ?? "").toUpperCase()) && currentLeadMinutes !== nextLeadMinutes) {
        await saveInviteLeadMinutes({ silent: true });
      }
      const { data } = await api.post(`/manager/exams/${examId}/automation/start`, {}, headers);
      applyAutomationStatus(data);
      setAutomationConfirmOpen(false);
      showAutomationMessage("자동 시험 운영을 시작했습니다.");
    } catch (reason) {
      showAutomationMessage(apiErrorMessage(reason, "자동 시험 운영을 시작하지 못했습니다."), "error");
    } finally {
      setIsStartingAutomation(false);
    }
  };

  const retryExamAutomation = async () => {
    setIsRetryingAutomation(true);
    try {
      const { data } = await api.post(`/manager/exams/${examId}/automation/retry`, {}, headers);
      applyAutomationStatus(data);
      showAutomationMessage("실패한 자동화 단계를 다시 실행했습니다.");
    } catch (reason) {
      showAutomationMessage(apiErrorMessage(reason, "자동화 재시도를 실행하지 못했습니다."), "error");
    } finally {
      setIsRetryingAutomation(false);
    }
  };

  const updateAutomationControl = async (action) => {
    setIsUpdatingAutomationControl(true);
    try {
      const { data } = await api.post(`/manager/exams/${examId}/automation/${action}`, {}, headers);
      applyAutomationStatus(data);
      showAutomationMessage({ pause: "자동 시험 운영을 일시정지했습니다.", resume: "자동 시험 운영을 재개했습니다.", cancel: "자동 시험 운영을 취소했습니다." }[action]);
    } catch (reason) {
      showAutomationMessage(apiErrorMessage(reason, { pause: "자동 시험 운영을 일시정지하지 못했습니다.", resume: "자동 시험 운영을 재개하지 못했습니다.", cancel: "자동 시험 운영을 취소하지 못했습니다." }[action]), "error");
    } finally {
      setIsUpdatingAutomationControl(false);
    }
  };

  const cancelExamAutomation = () => {
    if (!window.confirm("자동 시험 운영을 취소할까요? 이미 완료된 배정이나 발송 작업은 되돌아가지 않습니다.")) return;
    updateAutomationControl("cancel");
  };

  const startEditingExamTitle = () => {
    setExamTitleDraft(exam.title);
    setIsEditingExamTitle(true);
  };

  const saveExamTitle = async () => {
    const title = examTitleDraft.trim();
    if (!title) return showMessage("시험 제목을 입력해 주세요.", "error");
    if (title.length > 100) return showMessage("시험 제목은 100자 이하로 입력해 주세요.", "error");
    setIsSavingExamTitle(true);
    try {
      const { data } = await api.patch(`/manager/exams/${examId}`, { title }, headers);
      setExam(data);
      setIsEditingExamTitle(false);
      showMessage("시험 제목을 수정했습니다.");
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "시험 제목을 수정하지 못했습니다."), "error");
    } finally {
      setIsSavingExamTitle(false);
    }
  };

  const reviewIdentityVerificationRequest = async (requestId, status) => {
    setReviewingIdentityRequestId(requestId);
    try {
      await api.patch(`/manager/exams/${examId}/identity-verification-requests/${requestId}`, { status }, headers);
      await load();
      showMessage(status === "APPROVED" ? "대체 신원확인 요청을 승인했습니다." : "대체 신원확인 요청을 반려했습니다.");
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "대체 신원확인 요청을 처리하지 못했습니다."), "error");
    } finally {
      setReviewingIdentityRequestId("");
    }
  };

  useEffect(() => {
    load().catch((reason) =>
      setError(
        apiErrorMessage(reason, "시험 상세 정보를 불러오지 못했습니다."),
      ),
    );
  }, [load]);

  useEffect(() => {
    if (activeManagementPanel !== "candidates") return undefined;
    let active = true;
    const refreshCandidateOperations = () => Promise.all([
      api.get(`/manager/exams/${examId}/identity-verification-requests`, headers),
      api.get("/manager/invitations", headers),
    ])
      .then(([identityResponse, invitationResponse]) => {
        if (!active) return;
        setIdentityVerificationRequests(identityResponse.data);
        const activeInvitations = invitationResponse.data.filter((invitation) => invitation.examId === examId && !invitation.revokedAt);
        setInvitedCandidateIds([...new Set(activeInvitations.map((invitation) => invitation.candidateId))]);
        setMailPreviews(activeInvitations
          .filter((invitation) => invitation.entryLink)
          .map((invitation) => {
            const candidate = candidates.find((item) => item.id === invitation.candidateId);
            return {
              entryLink: invitation.entryLink,
              to: candidate?.email ?? "이메일 미등록",
              candidateNumber: invitation.candidateNumber ?? candidate?.candidateNumber ?? "",
            };
          }));
      })
      .catch(() => {});
    refreshCandidateOperations();
    const timer = window.setInterval(refreshCandidateOperations, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeManagementPanel, candidates, examId, headers]);

  useEffect(() => {
    if (activeManagementPanel !== "automation") return undefined;
    let active = true;
    const refreshAutomationStatus = () => api.get(`/manager/exams/${examId}/automation-status`, headers)
      .then(({ data }) => { if (active) applyAutomationStatus(data); })
      .catch(() => {});
    refreshAutomationStatus();
    const timer = window.setInterval(refreshAutomationStatus, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeManagementPanel, applyAutomationStatus, examId, headers]);

  const examCandidateScope = useMemo(
    () => getExamCandidateScope({
      candidates: organizationCandidates,
      assignedCandidateIds,
    }),
    [organizationCandidates, assignedCandidateIds],
  );
  const scopedCandidates = examCandidateScope.candidates;
  const assignableCandidates = scopedCandidates;
  const visibleCandidates = scopedCandidates.filter((candidate) =>
    `${candidate.name} ${candidate.email}`.toLowerCase().includes(candidateSearch.trim().toLowerCase()),
  );
  const allCandidatesSelected =
    visibleCandidates.length > 0 &&
    visibleCandidates.every((candidate) =>
      selectedCandidateIds.includes(candidate.id),
    );
  const selectedAssignedCount = selectedCandidateIds.filter((candidateId) =>
    assignedCandidateIds.includes(candidateId),
  ).length;

  const requestAiReferenceAnswer = async (sourceForm = questionForm, isCurrent = () => true) => {
    const requestForm = sourceForm;
    if (!isCurrent()) return false;
    setQuestionForm((current) => ({
      ...current,
      aiAnalysis: {
        ...current.aiAnalysis,
        referenceAnswer: {
          generatedAt: "",
          ...(current.aiAnalysis.referenceAnswer ?? {}),
          status: "PROCESSING",
          errorMessage: "",
          errorDetail: "",
          errorCode: "",
          providerStatus: undefined,
        },
      },
    }));
    try {
      const { data } = await api.post(`/manager/exams/${examId}/ai-reference-answer`, {
        question: { ...requestForm, type: "CODING", numericTolerance: Number(requestForm.numericTolerance) },
      }, headers);
      if (!isCurrent()) return false;
      if (data.feasible === false) {
        setQuestionForm((current) => ({
          ...current,
          aiAnalysis: {
            ...current.aiAnalysis,
            referenceAnswer: {
              status: "BLOCKED",
              generatedAt: data.generatedAt ?? "",
              feasibilityMessage: data.feasibilityMessage ?? "모범 답안을 생성할 수 없는 문제 조건입니다.",
              warnings: data.warnings ?? [],
              provider: data.provider ?? "",
              model: data.model ?? "",
            },
          },
        }));
        showMessage(data.feasibilityMessage ?? "현재 문제 조건으로는 모범 답안을 생성할 수 없습니다.", "error");
        return false;
      }
      setQuestionForm((current) => ({
        ...current,
        referenceSolutions: { ...current.referenceSolutions, ...(data.answers ?? {}) },
        aiAnalysis: {
          ...current.aiAnalysis,
          referenceAnswer: { ...current.aiAnalysis.referenceAnswer, status: "GENERATED", generatedAt: data.generatedAt ?? "", feasibilityMessage: "", errorMessage: "", errorDetail: "", errorCode: "", providerStatus: undefined, warnings: data.warnings ?? [], provider: data.provider ?? "", model: data.model ?? "" },
        },
      }));
      showMessage("입력한 문제 정보를 바탕으로 AI 모범 답안을 생성했습니다.");
      return true;
    } catch (reason) {
      if (!isCurrent()) return false;
      const errorMessage = apiErrorMessage(reason, reason?.message || "AI 모범 답안 생성에 실패했습니다.");
      const failure = reason?.response?.data ?? {};
      setQuestionForm((current) => ({
        ...current,
        aiAnalysis: {
          ...current.aiAnalysis,
          referenceAnswer: {
            ...current.aiAnalysis.referenceAnswer,
            status: "FAILED",
            errorMessage,
            errorDetail: typeof failure.detail === "string" ? failure.detail : "",
            errorCode: failure.providerCode || failure.code || "",
            providerStatus: failure.providerStatus,
            provider: failure.provider || "",
            model: failure.model || "",
          },
        },
      }));
      showMessage(failure.detail ? `${errorMessage} 상세 원인: ${failure.detail}` : errorMessage, "error");
      return false;
    }
  };



  const createQuestion = async (event) => {
    event.preventDefault();
    try {
      const payload = questionType === "CODING"
        ? { ...questionForm, type: "CODING", numericTolerance: Number(questionForm.numericTolerance) }
        : { ...multipleChoiceForm, type: "MULTIPLE_CHOICE" };
      if (editingQuestionId)
        await api.patch(
          `/manager/exams/${examId}/questions/${editingQuestionId}`,
          payload,
          headers,
        );
      else
        await api.post(`/manager/exams/${examId}/questions`, payload, headers);
      setQuestionForm(initialCodingProblem());
      setMultipleChoiceForm(initialMultipleChoiceQuestion());
      setQuestionType("CODING");
      setEditingQuestionId("");
      showMessage(
        editingQuestionId
          ? "문제 수정 사항을 저장했습니다."
          : "문제가 등록되었습니다.",
      );
      await load();
      return true;
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "문제 등록에 실패했습니다."), "error");
      return false;
    }
  };

  const registerQueuedQuestion = async (form, onStage, signal) => {
    onStage("answer");
    const { data } = await api.post(`/manager/exams/${examId}/ai-reference-answer`, {
      question: { ...form, type: "CODING", numericTolerance: Number(form.numericTolerance) },
    }, { ...headers, signal });
    if (data.feasible === false) throw new Error(data.feasibilityMessage || "모범 답안을 생성할 수 없는 문제입니다.");
    onStage("registering");
    await api.post(`/manager/exams/${examId}/questions`, {
      ...form,
      type: "CODING",
      numericTolerance: Number(form.numericTolerance),
      referenceSolutions: { ...form.referenceSolutions, ...(data.answers ?? {}) },
      aiAnalysis: { ...form.aiAnalysis, authoringSource: "AI_ASSISTANT", referenceAnswer: { status: "GENERATED", generatedAt: data.generatedAt ?? "", warnings: data.warnings ?? [], provider: data.provider ?? "", model: data.model ?? "" } },
    }, { ...headers, signal });
    await load();
  };

  const updateTestCase = (collection, index, field, value) =>
    setQuestionForm((current) => ({
      ...current,
      [collection]: current[collection].map((testCase, testIndex) =>
        testIndex === index ? { ...testCase, [field]: value } : testCase,
      ),
    }));

  const addTestCase = (collection) =>
    setQuestionForm((current) => ({
      ...current,
      [collection]: [
        ...current[collection],
        collection === "publicExamples"
          ? { input: "", expectedOutput: "", explanation: "" }
          : { input: "", expectedOutput: "" },
      ],
    }));

  const removeTestCase = (collection, index) =>
    setQuestionForm((current) => ({
      ...current,
      [collection]: current[collection].filter(
        (_, testIndex) => testIndex !== index,
      ),
    }));

  const toggleLanguage = (language) =>
    setQuestionForm((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language],
    }));

  const editQuestion = (question) => {
    setMessage("");
    setMessageType("info");
    const isCoding = question.type === "CODING";
    setQuestionType(isCoding ? "CODING" : "MULTIPLE_CHOICE");
    if (isCoding) setQuestionForm(questionToForm(question));
    else setMultipleChoiceForm({ prompt: question.prompt ?? "", options: question.options?.length ? question.options : ["", ""], answer: question.answer ?? "" });
    setEditingQuestionId(question.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelQuestionEdit = () => {
    setMessage("");
    setMessageType("info");
    setQuestionForm(initialCodingProblem());
    setMultipleChoiceForm(initialMultipleChoiceQuestion());
    setQuestionType("CODING");
    setEditingQuestionId("");
  };

  const confirmQuestionDelete = async () => {
    if (!questionToDelete) return;
    try {
      await api.delete(`/manager/exams/${examId}/questions/${questionToDelete.id}`, headers);
      if (editingQuestionId === questionToDelete.id) cancelQuestionEdit();
      showMessage("문제를 삭제했습니다.");
      setQuestionToDelete(null);
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "문제를 삭제하지 못했습니다."), "error");
      setQuestionToDelete(null);
    }
  };

  const createCandidate = async (event) => {
    event.preventDefault();
    try {
      const normalizedEmail = candidateForm.email.trim().toLowerCase();
      // 응시자는 시험 단위로 관리하므로, 같은 시험 안에서만 이메일 중복을 막습니다.
      if (candidates.some((candidate) => candidate.email.toLowerCase() === normalizedEmail)) {
        showMessage("이 응시자는 현재 시험에 이미 등록되어 있습니다.", "error");
        return;
      }
      const candidateId = (await api.post(
        "/manager/candidates",
        { ...candidateForm, email: normalizedEmail, organizationId: exam.organizationId, scope: "EXAM", examId },
        headers,
      )).data.id;
      await api.post(
        `/manager/exams/${examId}/assign`,
        { candidateIds: [candidateId] },
        headers,
      );
      setCandidateForm({ name: "", email: "", birthDate: "" });
      showMessage("응시자가 등록되었습니다.");
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "응시자 등록에 실패했습니다."), "error");
    }
  };

  const uploadCandidates = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(csv|tsv)$/i.test(file.name)) {
      setCandidateUploadError("CSV 또는 TSV 파일만 올릴 수 있습니다. 엑셀 파일은 CSV UTF-8 형식으로 저장한 뒤 올려주세요.");
      setCandidateUploadPreview([]);
      setCandidateUploadFileName("");
      return;
    }
    try {
      const parsedCandidates = parseCandidateCsv(await file.text());
      const assignedEmails = new Set(
        candidates.map((candidate) => candidate.email.toLowerCase()),
      );
      const uploadedEmails = new Set();
      // 응시자는 시험 단위로 관리하므로, 현재 시험 안에서의 중복만 오류로 처리합니다.
      const previewCandidates = parsedCandidates.map((candidate) => {
        const email = candidate.email.toLowerCase();
        const uploadError = assignedEmails.has(email)
          ? "현재 시험에 이미 등록된 이메일입니다."
          : uploadedEmails.has(email)
            ? "파일 안에 중복된 이메일입니다."
            : "";
        uploadedEmails.add(email);
        return { ...candidate, email, uploadError };
      });
      setCandidateUploadError("");
      setCandidateUploadPreview(previewCandidates);
      setCandidateUploadFileName(file.name);
      showMessage(`${previewCandidates.length}명을 확인했습니다. ${previewCandidates.filter((candidate) => !candidate.uploadError).length}명을 등록할 수 있습니다.`);
    } catch (reason) {
      const uploadError = apiErrorMessage(reason, reason.message || "응시자 파일을 등록하지 못했습니다.");
      setCandidateUploadError(uploadError);
      setCandidateUploadPreview([]);
      setCandidateUploadFileName("");
      showMessage(uploadError, "error");
    }
  };

  const registerUploadedCandidates = async () => {
    const uploadableCandidates = candidateUploadPreview.filter((candidate) => !candidate.uploadError);
    if (uploadableCandidates.length === 0) return;
    try {
      // 파일에 적힌 내용 그대로 이 시험 전용 응시자로 등록합니다.
      const createdCandidates = (await api.post(
        "/manager/candidates/bulk",
        {
          organizationId: exam.organizationId,
          scope: "EXAM",
          examId,
          candidates: uploadableCandidates.map(({ name, email, birthDate }) => ({ name, email, birthDate })),
        },
        headers,
      )).data;
      await api.post(
        `/manager/exams/${examId}/assign`,
        { candidateIds: createdCandidates.map((candidate) => candidate.id) },
        headers,
      );
      const remainingCandidates = candidateUploadPreview.filter((candidate) => candidate.uploadError);
      setCandidateUploadPreview(remainingCandidates);
      if (remainingCandidates.length === 0) setCandidateUploadFileName("");
      setCandidateUploadError("");
      showMessage(`${uploadableCandidates.length}명을 등록했습니다.${remainingCandidates.length ? ` ${remainingCandidates.length}명은 오류를 확인해 주세요.` : ""}`);
      await load();
    } catch (reason) {
      const uploadError = apiErrorMessage(reason, "응시자 파일을 등록하지 못했습니다.");
      setCandidateUploadError(uploadError);
      showMessage(uploadError, "error");
    }
  };

  const saveCandidate = async (event) => {
    event.preventDefault();
    try {
      await api.patch(`/manager/candidates/${editingCandidate.id}`, editingCandidate, headers);
      setEditingCandidate(null);
      showMessage("응시자 정보를 수정했습니다.");
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "응시자 정보를 수정하지 못했습니다."), "error");
    }
  };

  const toggleCandidate = (id) =>
    setSelectedCandidateIds((current) =>
      current.includes(id)
        ? current.filter((candidateId) => candidateId !== id)
        : [...current, id],
    );

  const toggleAllCandidates = () => {
    const visibleCandidateIds = visibleCandidates.map((candidate) => candidate.id);
    setSelectedCandidateIds((current) =>
      allCandidatesSelected
        ? current.filter((candidateId) => !visibleCandidateIds.includes(candidateId))
        : [...new Set([...current, ...visibleCandidateIds])],
    );
  };

  const deleteCandidate = async (candidateId) => {
    if (!candidateId) return;
    try {
      await api.delete(`/manager/exams/${examId}/assignments`, {
        ...headers,
        data: { candidateIds: [candidateId] },
      });
      showMessage("응시자를 이 시험에서 제거했습니다.");
      setCandidateToDelete(null);
      setSelectedCandidateIds((current) => current.filter((id) => id !== candidateId));
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "응시자를 이 시험에서 제거하지 못했습니다."), "error");
    }
  };

  const sendInvitations = async () => {
    if (selectedCandidateIds.some((candidateId) => !assignableCandidates.find((candidate) => candidate.id === candidateId)?.birthDate)) {
      showMessage("신원확인을 위해 생년월일이 없는 응시자의 정보를 먼저 수정해 주세요.", "error");
      return;
    }
    try {
      await api.post(
        `/manager/exams/${examId}/assign`,
        { candidateIds: selectedCandidateIds },
        headers,
      );
      const { data } = await api.post(
        `/manager/exams/${examId}/invitations/send`,
        { candidateIds: selectedCandidateIds },
        headers,
      );
      setMailPreviews(data.mailPreviews ?? []);
      setCopiedEntryLink("");
      showMessage(
        data.deliveryStatus === "SENT"
          ? `${data.count}명에게 초대 메일을 전송했습니다.`
          : `${data.count}명 초대 정보가 생성되었습니다. 메일 서버 연결 전이라 미리보기 상태입니다.`,
      );
      await load();
    } catch (reason) {
      showMessage(
        apiErrorMessage(reason, "대상자 배정 또는 초대에 실패했습니다."), "error",
      );
    }
  };

  const copyEntryLink = async (entryLink) => {
    try {
      await navigator.clipboard.writeText(entryLink);
    } catch {
      const copyTarget = document.createElement("textarea");
      copyTarget.value = entryLink;
      copyTarget.setAttribute("readonly", "");
      copyTarget.style.position = "fixed";
      copyTarget.style.opacity = "0";
      document.body.append(copyTarget);
      copyTarget.select();
      const copied = document.execCommand("copy");
      copyTarget.remove();
      if (!copied) {
        showMessage(
          "초대 링크를 복사하지 못했습니다. 아래 링크를 직접 선택해 복사해 주세요.", "error",
        );
        return;
      }
    }
    setCopiedEntryLink(entryLink);
    showMessage("초대 링크를 클립보드에 복사했습니다.");
  };

  const getFixedEntryLink = (entryLink) => {
    try {
      const url = new URL(entryLink);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        url.port = window.location.port;
      }
      return url.toString();
    } catch {
      return entryLink;
    }
  };

  const removeAssignments = async () => {
    const candidateIds = selectedCandidateIds.filter((candidateId) =>
      assignedCandidateIds.includes(candidateId),
    );
    if (!candidateIds.length) {
      showMessage("배정된 응시자를 먼저 선택해 주세요.", "error");
      return;
    }
    try {
      const { data } = await api.delete(
        `/manager/exams/${examId}/assignments`,
        { ...headers, data: { candidateIds } },
      );
      setSelectedCandidateIds([]);
      showMessage(
        `${data.removedCount}명의 시험 대상자 배정을 해제했습니다. 응시자 등록 정보는 유지됩니다.`
      );
      setAssignedCandidateIds((current) =>
        current.filter((id) => !candidateIds.includes(id))
      );
      setCandidates((current) =>
        current.filter((candidate) => !candidateIds.includes(candidate.id))
      );
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "시험 대상자 배정을 해제하지 못했습니다."), "error");
    }
  };

  if (error)
    return (
      <section className="workspace-shell">
        <div className="workspace-alert error">{error}</div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => navigate("/manager/exams")}
        >
          시험 목록으로
        </button>
      </section>
    );
  if (!exam)
    return (
      <section className="workspace-shell">
        <div className="workspace-loading">
          시험 상세 정보를 불러오는 중입니다...
        </div>
      </section>
    );

  return (
    <section className="workspace-shell manager-exam-detail-shell">
      <button
        className="back-link"
        type="button"
        onClick={() => navigate("/manager/exams")}
      >
        <ArrowLeft size={16} /> 시험 목록으로
      </button>
      <div className="workspace-heading no-bottom-margin manager-exam-heading">
        <div>
          <div className="title-with-badge">
            {isEditingExamTitle ? (
              <div className="exam-title-editor">
                <input aria-label="시험 제목" autoFocus maxLength={100} value={examTitleDraft} onChange={(event) => setExamTitleDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveExamTitle(); if (event.key === "Escape") setIsEditingExamTitle(false); }} />
                <button className="primary-button compact-button" type="button" disabled={isSavingExamTitle} onClick={saveExamTitle}><Save size={15} /> {isSavingExamTitle ? "저장 중..." : "저장"}</button>
                <button className="secondary-button compact-button" type="button" disabled={isSavingExamTitle} onClick={() => setIsEditingExamTitle(false)}><X size={15} /> 취소</button>
              </div>
            ) : (
              <div className="exam-title-display"><h1>{exam.title}</h1><button className="icon-button" type="button" aria-label="시험 제목 수정" onClick={startEditingExamTitle}><Pencil size={17} /></button></div>
            )}
            <span className="status-badge approved">{exam.status}</span>
          </div>
          <p>
            {exam.date} · {exam.duration}
          </p>
        </div>
      </div>
      {message && activeManagementPanel !== "questions" && <div className={`workspace-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}
      <div className="exam-agent-toolbar" aria-label="시험 관리 도구">
        <div><strong>자동 시험 운영 에이전트</strong><span>시험 준비부터 초대·채점·결과 안내까지 관리합니다.</span></div>
        <div className="exam-agent-manual-tools">
          <button className="exam-agent-tool-button" type="button" onClick={() => { setActiveManagementPanel("questions"); setMessage(""); }}>
            <span className="exam-agent-tool-icon"><BookOpen size={22} /></span>
            <span className="exam-agent-tool-copy"><strong>문제 관리</strong><small>문제 작성 및 시험지 확인</small></span>
            <span className="exam-agent-tool-count">{questions.length}</span>
          </button>
          <button className="exam-agent-tool-button" type="button" onClick={() => { setActiveManagementPanel("candidates"); setMessage(""); }}>
            <span className="exam-agent-tool-icon"><Users size={22} /></span>
            <span className="exam-agent-tool-copy"><strong>응시자 운영</strong><small>응시자 등록 및 신원확인</small></span>
            <span className="exam-agent-tool-count">{examCandidateScope.count}</span>
          </button>
        </div>
      </div>

      <div className="confirm-modal management-workspace-modal" role="dialog" aria-modal="true" aria-label="문제 관리" hidden={activeManagementPanel !== "questions"}>
        <button className="confirm-modal-backdrop" type="button" aria-label="문제 관리 닫기" onClick={() => setActiveManagementPanel("automation")} />
        <section className="confirm-modal-panel management-workspace-modal-panel">
          <div className="management-workspace-modal-heading"><div><h2>문제 관리</h2><p>시험 문제를 만들고 미리 확인합니다.</p></div><button className="icon-button" type="button" aria-label="문제 관리 닫기" onClick={() => setActiveManagementPanel("automation")}><X size={20} /></button></div>
          <QuestionManagement
        examId={examId}
        message={message} messageType={messageType}
        questionType={questionType} setQuestionType={setQuestionType} questionForm={questionForm} setQuestionForm={setQuestionForm}
        editingQuestionId={editingQuestionId} createQuestion={createQuestion}
        addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateTestCase} toggleLanguage={toggleLanguage}
        cancelQuestionEdit={cancelQuestionEdit} questions={questions} editQuestion={editQuestion} setQuestionToDelete={setQuestionToDelete}
        openPreview={() => setIsExamPreviewOpen(true)} requestAiReferenceAnswer={requestAiReferenceAnswer} registerQueuedQuestion={registerQueuedQuestion}
          />
        </section>
      </div>

      <ExamAutomationPanel
          questions={questions}
          automationStatus={automationStatus}
          inviteLeadDraft={inviteLeadDraft}
          setInviteLeadDraft={changeInviteLeadDraft}
          isSavingInviteLead={isSavingInviteLead}
          saveInviteLeadMinutes={saveInviteLeadMinutes}
          examScheduleDraft={examScheduleDraft}
          setExamScheduleDraft={setExamScheduleDraft}
          isSavingExamSchedule={isSavingExamSchedule}
          saveExamSchedule={saveExamSchedule}
          isStartingAutomation={isStartingAutomation}
          isRetryingAutomation={isRetryingAutomation}
          retryExamAutomation={retryExamAutomation}
          isUpdatingAutomationControl={isUpdatingAutomationControl}
          pauseExamAutomation={() => updateAutomationControl("pause")}
          resumeExamAutomation={() => updateAutomationControl("resume")}
          cancelExamAutomation={cancelExamAutomation}
          automationControlMessage={automationControlMessage}
          openAutomationConfirm={() => { setMessage(""); setMessageType("info"); setAutomationConfirmOpen(true); }}
      />

      {activeManagementPanel === "candidates" && (
        <div className="confirm-modal management-workspace-modal" role="dialog" aria-modal="true" aria-label="응시자 운영">
        <button className="confirm-modal-backdrop" type="button" aria-label="응시자 운영 닫기" onClick={() => setActiveManagementPanel("automation")} />
        <section className="confirm-modal-panel management-workspace-modal-panel">
        <div className="management-workspace-modal-heading"><div><h2>응시자 운영</h2><p>응시자 등록, 초대 및 대체 신원확인 요청을 관리합니다.</p></div><button className="icon-button" type="button" aria-label="응시자 운영 닫기" onClick={() => setActiveManagementPanel("automation")}><X size={20} /></button></div>
        <div className="candidate-management-popup-content">
        {message && <div className={`workspace-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}
        <section id="identity-management" className="data-panel detail-management-panel">
          <div className="panel-heading">
            <div>
              <h2>대체 신원확인 요청</h2>
              <p>신분증이 없는 응시자의 요청을 확인하고 승인하거나 반려하세요.</p>
            </div>
            <Users size={20} />
          </div>
          <div className="candidate-list-table">
            {identityVerificationRequests.length ? identityVerificationRequests.map((item) => (
              <div className="candidate-list-row" key={item.id}>
                <span style={{ fontWeight: 700 }}>{item.candidateName} · {item.candidateNumber}</span>
                <span>{item.status === "PENDING" ? "승인 대기" : item.status === "APPROVED" ? "승인됨" : "반려됨"}</span>
                <span>{item.requestedAt ? new Date(item.requestedAt).toLocaleString("ko-KR") : "-"}</span>
                <div className="candidate-row-actions">
                  {item.status === "PENDING" && <>
                    <button className="primary-button compact-button" type="button" disabled={reviewingIdentityRequestId === item.id} onClick={() => reviewIdentityVerificationRequest(item.id, "APPROVED")}>승인</button>
                    <button className="danger-button compact-button" type="button" disabled={reviewingIdentityRequestId === item.id} onClick={() => reviewIdentityVerificationRequest(item.id, "REJECTED")}>반려</button>
                  </>}
                </div>
              </div>
            )) : <p className="empty-state">대체 신원확인 요청이 없습니다.</p>}
          </div>
        </section>
        <div className="candidate-operations-layout">
        <form
          id="candidate-management"
          className="data-panel form-panel detail-management-panel"
          onSubmit={createCandidate}
        >
          <div className="panel-heading">
            <div>
              <h2>응시자 등록</h2>
              <p>응시자를 개별 등록하거나 CSV로 한 번에 등록할 수 있습니다.</p>
            </div>
            <Users size={20} />
          </div>
          <label>
            응시자 이름
            <input
              value={candidateForm.name}
              onChange={(event) =>
                setCandidateForm({ ...candidateForm, name: event.target.value })
              }
              required
            />
          </label>
          <label>
            응시자 이메일
            <input
              type="email"
              value={candidateForm.email}
              onChange={(event) =>
                setCandidateForm({
                  ...candidateForm,
                  email: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            생년월일
            <input
              type="date"
              value={candidateForm.birthDate}
              onChange={(event) =>
                setCandidateForm({ ...candidateForm, birthDate: event.target.value })
              }
              required
            />
          </label>
          <button className="primary-button" type="submit">
            <Users size={16} /> 응시자 등록
          </button>
          <label className="candidate-upload-control">
            <FileUp size={16} /> CSV 파일로 일괄 등록
            <input type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" onChange={uploadCandidates} />
          </label>
          <p className="form-hint">첫 줄은 <strong>이름, 이메일, 생년월일</strong>이어야 합니다. 생년월일은 YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYYMMDD, YYMMDD 형식을 지원합니다.</p>
          {candidateUploadError && <p className="candidate-upload-error" role="alert">파일 등록 실패: {candidateUploadError}</p>}
          {candidateUploadPreview.length > 0 && (
            <section className="candidate-upload-preview" aria-label="CSV 등록 예정 응시자">
              <div className="candidate-upload-preview-heading">
                <div>
                  <strong>{candidateUploadFileName}</strong>
                  <span>등록 가능 <b>{uploadableCandidateCount}명</b>{uploadErrorCount > 0 && <> · 오류 <b className="candidate-upload-error-count">{uploadErrorCount}명</b></>}</span>
                </div>
                <button className="primary-button" type="button" onClick={registerUploadedCandidates} disabled={uploadableCandidateCount === 0}>
                  <Users size={16} /> {uploadableCandidateCount}명 등록
                </button>
              </div>
              <ul>
                {candidateUploadPreview.map((candidate, index) => (
                  <li key={`${candidate.email}-${index}`} className={candidate.uploadError ? "has-error" : ""}>
                    <b>{index + 1}</b>
                    <span><strong>{candidate.name}</strong><small>{candidate.email} · {candidate.birthDate}</small>{candidate.uploadError && <em>{candidate.uploadError}</em>}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </form>
      <div id="invitation-management" className="data-panel detail-management-panel">
        <div className="panel-heading">
          <div>
            <h2>응시자 현황 및 초대</h2>
            <p>응시자별 배정 및 초대 상태를 확인하고 관리하세요.</p>
          </div>
          <div className="invitation-panel-actions">
            <Send size={20} />
          </div>
        </div>
        <div className="candidate-controls-group">
          <div className="candidate-toolbar">
            <label className="select-all-control"><input type="checkbox" checked={allCandidatesSelected} onChange={toggleAllCandidates} disabled={!visibleCandidates.length} /><span>전체 선택</span></label>
          </div>
          <label className="candidate-search-control"><Search size={16} /><input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="이름 또는 이메일 검색" /></label>
        </div>
        {editingCandidate && (
          <form className="candidate-edit-panel" onSubmit={saveCandidate}>
            <div className="section-title-row">
              <strong>{editingCandidate.candidateNumber} 응시자 정보 수정</strong>
              <button className="text-button" type="button" onClick={() => setEditingCandidate(null)}>닫기</button>
            </div>
            <div className="form-row">
              <label>이름<input value={editingCandidate.name} onChange={(event) => setEditingCandidate({ ...editingCandidate, name: event.target.value })} required /></label>
              <label>이메일<input type="email" value={editingCandidate.email} onChange={(event) => setEditingCandidate({ ...editingCandidate, email: event.target.value })} required /></label>
              <label>생년월일<input type="date" value={editingCandidate.birthDate ?? ""} onChange={(event) => setEditingCandidate({ ...editingCandidate, birthDate: event.target.value })} required /></label>
            </div>
            <button className="primary-button" type="submit"><Save size={16} /> 정보 저장</button>
          </form>
        )}
        <div className="candidate-check-list">
          {visibleCandidates.map((candidate) => (
            <label key={candidate.id}>
              <input
                type="checkbox"
                checked={selectedCandidateIds.includes(candidate.id)}
                onChange={() => toggleCandidate(candidate.id)}
              />
              <span>
                {candidate.name}
                <small>
                  {candidate.email} · {candidate.candidateNumber}
                </small>
                <small>생년월일: {candidate.birthDate ?? "미등록"}</small>
              </span>
              {assignedCandidateIds.includes(candidate.id) ? (
                <em className="assignment-state">배정됨</em>
              ) : (
                <em className="assignment-state rejected">배정되지 않음</em>
              )}
              {invitedCandidateIds.includes(candidate.id) ? (
                <em className="invitation-state sent">초대 발송</em>
              ) : (
                <em className="invitation-state">미초대</em>
              )}
              <button className="secondary-button compact-button" type="button" onClick={(event) => { event.preventDefault(); setEditingCandidate({ ...candidate }); }}>
                <Pencil size={14} /> 수정
              </button>
              <button className="danger-button compact-button" type="button" onClick={(event) => { event.preventDefault(); setCandidateToDelete(candidate); }}>
                <Trash2 size={14} /> 제거
              </button>
            </label>
          ))}
          {!visibleCandidates.length && (
            <p className="empty-state">검색 결과가 없습니다.</p>
          )}
        </div>
        {candidateToDelete && (
          <div className="workspace-alert error candidate-remove-confirmation">
            <span><strong>{candidateToDelete.name}</strong> 응시자를 이 시험에서 제거하시겠습니까? 조직 응시자 정보는 유지됩니다.</span>
            <div className="candidate-row-actions">
              <button className="secondary-button compact-button" type="button" onClick={() => setCandidateToDelete(null)}>취소</button>
              <button className="danger-button compact-button" type="button" onClick={() => deleteCandidate(candidateToDelete.id)}>시험에서 제거</button>
            </div>
          </div>
        )}
        <div className="floating-action-bar static">
          <div className="floating-action-bar-content">
            <div className="candidate-selection-summary">
              <strong>{selectedCandidateIds.length}명 선택됨</strong>
              {selectedCandidateIds.length > 0 && (
                <span className="action-hint">
                  <CheckSquare size={14} /> 배정 해제해도 응시자 등록 정보는 삭제되지 않습니다.
                </span>
              )}
            </div>
            <div className="floating-action-buttons">
              <button className="primary-button" type="button" onClick={sendInvitations} disabled={selectedCandidateIds.length === 0}><Mail size={16} /> 선택 대상자 배정 및 초대</button>
              <button className="danger-button" type="button" disabled={!selectedAssignedCount} onClick={removeAssignments}><Trash2 size={16} /> 선택 대상자 배정 해제</button>
            </div>
          </div>
        </div>
        {mailPreviews.length > 0 && (
          <div className="mail-preview">
            <strong>응시자 초대 링크</strong>
            <p className="form-hint">
              테스트용 링크입니다. 링크를 복사해 새 시크릿 창에서 응시자 입장
              화면을 확인할 수 있습니다.
            </p>
            {mailPreviews.map((preview) => {
              const fixedLink = getFixedEntryLink(preview.entryLink);
              return (
                <div className="mail-preview-row" key={preview.entryLink}>
                  <div>
                    <strong>{preview.to}</strong>
                    <span className="invite-candidate-number">
                      <b>응시번호</b>
                      <code>{preview.candidateNumber}</code>
                    </span>
                    <code>{fixedLink}</code>
                  </div>
                  <div
                    className="candidate-action-row"
                    style={{ flexWrap: "nowrap" }}
                  >
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      onClick={() => copyEntryLink(fixedLink)}
                    >
                      {copiedEntryLink === fixedLink ? (
                        <Check size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                      {copiedEntryLink === fixedLink ? "복사됨" : "링크 복사"}
                    </button>
                    <a
                      href={fixedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="secondary-button compact-button"
                    >
                      <ExternalLink size={16} /> 바로가기
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
        </div>
        </section>
        </div>
      )}

      {automationConfirmOpen && (
        <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="automation-start-title">
          <button className="confirm-modal-backdrop" type="button" aria-label="자동 운영 시작 확인 닫기" onClick={() => setAutomationConfirmOpen(false)} />
          <section className="confirm-modal-panel exam-automation-confirm-panel">
            <h2 id="automation-start-title">자동 시험 운영을 시작할까요?</h2>
            <p>저장된 문제와 초대 가능한 응시자를 기준으로 자동 배정과 초대 발송을 시작합니다.</p>
            {message && messageType === "error" && <div className="workspace-alert error" role="alert">{message}</div>}
            <dl className="exam-automation-confirm-list">
              <div><dt>저장된 문제</dt><dd>{automationStatus?.preview?.questionCount ?? automationStatus?.exam?.questionCount ?? questions.length}개</dd></div>
              <div><dt>등록 응시자</dt><dd>{automationStatus?.state?.totalCandidateCount ?? automationStatus?.preview?.totalCandidateCount ?? 0}명</dd></div>
              <div><dt>초대 가능 응시자</dt><dd>{automationStatus?.state?.eligibleCandidateCount ?? automationStatus?.preview?.eligibleCandidateCount ?? 0}명</dd></div>
              <div><dt>제외 대상</dt><dd>{automationStatus?.state?.excludedCandidateCount ?? automationStatus?.preview?.excludedCandidateCount ?? 0}명</dd></div>
              <div><dt>예상 초대 시각</dt><dd>{formatAutomationScheduledAt(computeExpectedInvitationAt(automationStatus?.exam?.startsAt ?? automationStatus?.state?.startsAt, inviteLeadDraft) ?? automationStatus?.state?.invitationScheduledAt)}</dd></div>
            </dl>
            <p className="form-hint">시작 후 초대가 생성되기 전까지만 발송 시점을 수정할 수 있습니다.</p>
            <div className="confirm-modal-actions">
              <button className="secondary-button" type="button" onClick={() => setAutomationConfirmOpen(false)}>취소</button>
              <button className="primary-button" type="button" onClick={startExamAutomation} disabled={isStartingAutomation}>
                {isStartingAutomation ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} 문제 작성 완료 및 자동 운영 시작
              </button>
            </div>
          </section>
        </div>
      )}

      {isExamPreviewOpen && (
        <div className="exam-preview-modal" role="dialog" aria-modal="true" aria-labelledby="exam-preview-title">
          <button className="exam-preview-backdrop" type="button" aria-label="시험지 미리보기 닫기" onClick={() => setIsExamPreviewOpen(false)} />
          <section className="exam-preview-panel">
            <header className="exam-preview-heading">
              <div>
                <h2 id="exam-preview-title">{exam.title}</h2>
                <p>{exam.date} · {exam.duration} · 총 {questions.length}문제</p>
              </div>
              <button className="icon-button" type="button" aria-label="시험지 미리보기 닫기" onClick={() => setIsExamPreviewOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="exam-preview-notice">
              응시자에게 표시되는 문제 내용과 공개 예제만 미리봅니다. 비공개 채점 케이스와 모범 답안은 표시되지 않습니다.
            </div>
            <div className="exam-preview-questions">
              {questions.map((question, index) => (
                <article className="exam-preview-question" key={question.id}>
                  <div className="exam-preview-question-heading">
                    <span>문제 {index + 1}</span>
                    {question.type === "CODING" && <em>{(question.languages ?? []).join(" · ") || "코딩"}</em>}
                  </div>
                  <h3>{question.type === "CODING" ? question.title : question.prompt}</h3>
                  {question.type === "CODING" ? (
                    <>
                      <p className="exam-preview-description">{question.description}</p>
                      <PreviewDetail title="입력 형식" content={question.inputFormat} />
                      <PreviewDetail title="출력 형식" content={question.outputFormat} />
                      <PreviewDetail title="제한" content={question.constraints} />
                      {(question.publicExamples ?? []).map((example, exampleIndex) => (
                        <section className="exam-preview-example" key={`${question.id}-example-${exampleIndex}`}>
                          <strong>예제 {exampleIndex + 1}</strong>
                          <div><span>입력</span><pre>{example.input}</pre></div>
                          <div><span>출력</span><pre>{example.expectedOutput}</pre></div>
                          {example.explanation && <p>{example.explanation}</p>}
                        </section>
                      ))}
                    </>
                  ) : (
                    <div className="exam-preview-options">
                      {(question.options ?? []).filter(Boolean).map((option) => <div key={option}>{option}</div>)}
                    </div>
                  )}
                </article>
              ))}
              {!questions.length && <p className="empty-state">아직 등록된 문제가 없습니다.</p>}
            </div>
            <footer className="exam-preview-footer">
              <button className="secondary-button" type="button" onClick={() => setIsExamPreviewOpen(false)}>닫기</button>
            </footer>
          </section>
        </div>
      )}
      {questionToDelete && (
        <div className="confirm-modal question-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-question-title">
          <button className="confirm-modal-backdrop" type="button" aria-label="삭제 취소" onClick={() => setQuestionToDelete(null)} />
          <section className="confirm-modal-panel"><h2 id="delete-question-title">문제를 삭제할까요?</h2><p><strong>{questionToDelete.type === "CODING" ? questionToDelete.title : questionToDelete.prompt}</strong>은(는) 되돌릴 수 없습니다. 초대 발송 후에는 문제를 삭제할 수 없습니다.</p><div className="confirm-modal-actions"><button className="secondary-button" type="button" onClick={() => setQuestionToDelete(null)}>취소</button><button className="danger-button" type="button" onClick={confirmQuestionDelete}><Trash2 size={16} /> 삭제</button></div></section>
        </div>
      )}
    </section>
  );
}

const CODING_EDITOR_TABS = [
  { id: "problem", label: "문제 검토 및 수정", fields: ["title", "languages", "description", "inputFormat", "outputFormat", "constraints"] },
  { id: "tests", label: "테스트 및 채점", fields: ["publicExamples", "hiddenTestCases", "numericTolerance", "customJudgeCode"] },
];

const editorTabForField = (field) => CODING_EDITOR_TABS.find((tab) => tab.fields.includes(field))?.id ?? "problem";
const referenceAnswerSignature = (form) => JSON.stringify({
  title: form.title,
  languages: form.languages,
  description: form.description,
  inputFormat: form.inputFormat,
  outputFormat: form.outputFormat,
  constraints: form.constraints,
  publicExamples: form.publicExamples,
  hiddenTestCases: form.hiddenTestCases,
  judgeMode: form.judgeMode,
  numericTolerance: form.numericTolerance,
  customJudgeCode: form.customJudgeCode,
  aiAnalysis: { ...form.aiAnalysis, referenceAnswer: undefined, validation: undefined },
});


function QuestionManagement({ examId, message, messageType, questionType, setQuestionType, questionForm, setQuestionForm, editingQuestionId, createQuestion, registerQueuedQuestion, addTestCase, removeTestCase, updateTestCase, toggleLanguage, cancelQuestionEdit, questions, editQuestion, setQuestionToDelete, openPreview, requestAiReferenceAnswer }) {
  const isCoding = questionType === "CODING";
  const updateForm = (field, value) => {
    setQuestionForm((current) => ({ ...current, [field]: value }));
    setVisibleErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const [visibleErrors, setVisibleErrors] = useState({});
  const [draftOffer, setDraftOffer] = useState(null);
  const [draftStatus, setDraftStatus] = useState("idle");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [editorTab, setEditorTab] = useState("problem");
  const [isAuthoringOpen, setIsAuthoringOpen] = useState(false);
  const [aiDraftApplyNonce, setAiDraftApplyNonce] = useState(0);
  const [aiAuthoringComplete, setAiAuthoringComplete] = useState(false);
  const [aiAuthoringResetNonce, setAiAuthoringResetNonce] = useState(0);
  const [assistantRequirements, setAssistantRequirements] = useState(null);
  const [assistantRestoreNonce, setAssistantRestoreNonce] = useState(0);
  const [autoRegistrationState, setAutoRegistrationState] = useState("idle");
  const [generationQueue, setGenerationQueue] = useState([]);
  const generationWorkerActive = useRef(false);
  const generationAbortRef = useRef(null);
  const [generatedAnswerSignature, setGeneratedAnswerSignature] = useState("");
  const generatedAnswerSignatureRef = useRef("");
  const draftKey = codingDraftKey(examId, editingQuestionId);
  const blockedDraftKeys = useRef(new Set());
  const draftBaselines = useRef(new Map());
  const currentQuestionForm = useRef(questionForm);
  currentQuestionForm.current = questionForm;
  const requestAiReferenceAnswerRef = useRef(requestAiReferenceAnswer);
  requestAiReferenceAnswerRef.current = requestAiReferenceAnswer;
  const submitQuestionRef = useRef(null);
  const activeAnswerRequestSignature = useRef("");
  const handledAiDraftApplyNonce = useRef(0);
  const allErrors = validateCodingProblem(questionForm);
  const hasValidationErrors = Object.keys(allErrors).length > 0;
  const currentAnswerSignature = referenceAnswerSignature(questionForm);
  const answerState = questionForm.aiAnalysis.referenceAnswer ?? { status: "NOT_RUN" };
  const hasGeneratedSolutions = questionForm.languages.some((language) => String(questionForm.referenceSolutions?.[language] ?? "").trim());
  const answerOutdated = hasGeneratedSolutions
    && Boolean(generatedAnswerSignature)
    && generatedAnswerSignature !== currentAnswerSignature;
  const referenceAnswerReady = answerState.status === "GENERATED"
    && generatedAnswerSignature === currentAnswerSignature
    && questionForm.languages.every((language) => String(questionForm.referenceSolutions?.[language] ?? "").trim());
  useEffect(() => {
    if (generationWorkerActive.current) return;
    const nextJob = generationQueue.find((job) => job.status === "queued");
    if (!nextJob) return;
    generationWorkerActive.current = true;
    const controller = new AbortController();
    generationAbortRef.current = { jobId: nextJob.id, controller };
    const updateJob = (changes) => setGenerationQueue((current) => current.map((job) => job.id === nextJob.id ? { ...job, ...changes } : job));
    updateJob({ status: "running", stage: "generating" });
    generateProblemCandidates(examId, nextJob.requirements, (step) => updateJob({ activity: step }), controller.signal)
      .then((result) => {
        const candidate = result.candidates?.[0];
        if (!candidate) throw new Error("생성된 문제 시안이 없습니다.");
        const form = candidateToProblem(candidate).form;
        updateJob({ title: form.title || nextJob.title, stage: "answer" });
        return registerQueuedQuestion(form, (stage) => updateJob({ stage }), controller.signal);
      })
      .then(() => updateJob({ status: "complete", stage: "complete" }))
      .catch((reason) => {
        if (controller.signal.aborted) updateJob({ status: "cancelled", activity: "작업을 중단했습니다." });
        else updateJob({ status: "failed", error: apiErrorMessage(reason, "문제를 자동 등록하지 못했습니다.") });
      })
      .finally(() => {
        if (generationAbortRef.current?.jobId === nextJob.id) generationAbortRef.current = null;
        generationWorkerActive.current = false;
        setGenerationQueue((current) => [...current]);
      });
  }, [examId, generationQueue, registerQueuedQuestion]);
  useEffect(() => {
    if (editingQuestionId) setIsAuthoringOpen(true);
  }, [editingQuestionId]);

  useEffect(() => {
    setVisibleErrors({});
    setEditorTab("problem");
    setAiAuthoringComplete(false);
    setAssistantRequirements(null);
    setDraftOffer(null);
    const form = currentQuestionForm.current;
    const existingSignature = form.aiAnalysis.referenceAnswer?.status === "GENERATED"
      && form.languages.every((language) => String(form.referenceSolutions?.[language] ?? "").trim())
      ? referenceAnswerSignature(form)
      : "";
    generatedAnswerSignatureRef.current = existingSignature;
    setGeneratedAnswerSignature(existingSignature);
    activeAnswerRequestSignature.current = "";
    draftBaselines.current.set(draftKey, JSON.stringify({ form: currentQuestionForm.current, assistantRequirements: null }));
    const parsed = parseCodingDraft(localStorage.getItem(draftKey));
    if (parsed && hasMeaningfulCodingDraft(parsed.form)) {
      blockedDraftKeys.current.add(draftKey);
      setDraftOffer(parsed);
      setDraftSavedAt(parsed.savedAt);
    } else if (parsed) {
      localStorage.removeItem(draftKey);
      blockedDraftKeys.current.delete(draftKey);
      setDraftSavedAt("");
    }
  }, [draftKey]);

  useEffect(() => {
    const appliedFromAi = aiDraftApplyNonce !== handledAiDraftApplyNonce.current;
    if (!isCoding || !appliedFromAi) return undefined;
    handledAiDraftApplyNonce.current = aiDraftApplyNonce;
    if (hasValidationErrors || generatedAnswerSignatureRef.current === currentAnswerSignature) return undefined;
    setQuestionForm((current) => ({
      ...current,
      referenceSolutions: Object.fromEntries(Object.keys(current.referenceSolutions ?? {}).map((language) => [language, ""])),
      aiAnalysis: {
        ...current.aiAnalysis,
        referenceAnswer: { ...current.aiAnalysis.referenceAnswer, status: "NOT_RUN", errorMessage: "", feasibilityMessage: "" },
      },
    }));
    const timer = window.setTimeout(async () => {
      if (activeAnswerRequestSignature.current === currentAnswerSignature) return;
      activeAnswerRequestSignature.current = currentAnswerSignature;
      const succeeded = await requestAiReferenceAnswerRef.current(
        currentQuestionForm.current,
        () => referenceAnswerSignature(currentQuestionForm.current) === currentAnswerSignature
          && activeAnswerRequestSignature.current === currentAnswerSignature,
      );
      if (succeeded) {
        generatedAnswerSignatureRef.current = currentAnswerSignature;
        setGeneratedAnswerSignature(currentAnswerSignature);
      }
      if (activeAnswerRequestSignature.current === currentAnswerSignature) activeAnswerRequestSignature.current = "";
    }, 80);
    return () => window.clearTimeout(timer);
  }, [aiDraftApplyNonce, currentAnswerSignature, hasValidationErrors, isCoding, setQuestionForm]);

  useEffect(() => {
    if (!isCoding || blockedDraftKeys.current.has(draftKey)) return undefined;
    const draftSnapshot = { form: questionForm, assistantRequirements };
    if (draftBaselines.current.get(draftKey) === JSON.stringify(draftSnapshot)) return undefined;
    if (!hasMeaningfulCodingDraft(questionForm) && !hasMeaningfulAssistantRequirements(assistantRequirements)) {
      localStorage.removeItem(draftKey);
      setDraftSavedAt("");
      setDraftStatus("idle");
      return undefined;
    }
    setDraftStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        const serialized = serializeCodingDraft(questionForm, new Date().toISOString(), assistantRequirements);
        localStorage.setItem(draftKey, serialized);
        const parsed = parseCodingDraft(serialized);
        setDraftSavedAt(parsed.savedAt);
        setDraftStatus("saved");
      } catch {
        setDraftStatus("failed");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [assistantRequirements, draftKey, isCoding, questionForm]);

  const restoreDraft = () => {
    setQuestionForm(questionToForm(draftOffer.form));
    setAssistantRequirements(draftOffer.assistantRequirements ?? null);
    setAssistantRestoreNonce((current) => current + 1);
    setAiAuthoringComplete(
      draftOffer.form.aiAnalysis?.authoringSource === "AI_ASSISTANT"
      || draftOffer.form.aiAnalysis?.referenceAnswer?.status === "GENERATED"
      || Object.values(draftOffer.form.referenceSolutions ?? {}).some((source) => String(source ?? "").trim()),
    );
    blockedDraftKeys.current.delete(draftKey);
    setDraftOffer(null);
    setDraftStatus("saved");
  };
  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    blockedDraftKeys.current.delete(draftKey);
    setDraftOffer(null);
    setDraftSavedAt("");
    setDraftStatus("idle");
    setAssistantRequirements(null);
  };
  const toggleCodingLanguage = (language) => {
    toggleLanguage(language);
    setVisibleErrors((current) => {
      if (!current.languages) return current;
      const next = { ...current };
      delete next.languages;
      return next;
    });
  };
  const updateCodingTestCase = (collection, index, field, value) => {
    updateTestCase(collection, index, field, value);
    setVisibleErrors((current) => {
      if (!current[collection]) return current;
      const next = { ...current };
      delete next[collection];
      return next;
    });
  };
  const focusError = (field) => {
    setVisibleErrors((current) => ({ ...current, [field]: allErrors[field] }));
    setEditorTab(editorTabForField(field));
    window.setTimeout(() => document.getElementById(`coding-field-${field}`)?.focus(), 0);
  };
  const submitQuestion = async (event, { keepOpen = false } = {}) => {
    if (!isCoding) return createQuestion(event);
    event.preventDefault();
    const errors = validateCodingProblem(questionForm);
    setVisibleErrors(errors);
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      focusError(firstError);
      return false;
    }
    if (!referenceAnswerReady) return false;
    const saved = await createQuestion(event);
    if (saved) {
      localStorage.removeItem(draftKey);
      blockedDraftKeys.current.delete(draftKey);
      setDraftStatus("idle");
      generatedAnswerSignatureRef.current = "";
      setGeneratedAnswerSignature("");
      setAiAuthoringComplete(false);
      setAssistantRequirements(null);
      setAiAuthoringResetNonce((current) => current + 1);
      activeAnswerRequestSignature.current = "";
      if (!keepOpen) setIsAuthoringOpen(false);
    }
    return saved;
  };
  submitQuestionRef.current = submitQuestion;
  useEffect(() => {
    if (autoRegistrationState !== "answer" || !referenceAnswerReady) return;
    setAutoRegistrationState("registering");
    submitQuestionRef.current({ preventDefault: () => {} }, { keepOpen: true }).then((saved) => {
      setAutoRegistrationState(saved ? "complete" : "registration-failed");
    });
  }, [autoRegistrationState, referenceAnswerReady]);
  useEffect(() => {
    if (autoRegistrationState !== "answer") return;
    if (answerState.status === "FAILED" || answerState.status === "BLOCKED") setAutoRegistrationState("answer-failed");
  }, [answerState.status, autoRegistrationState]);
  useEffect(() => {
    if (autoRegistrationState !== "complete") return undefined;
    const timer = window.setTimeout(() => {
      setAutoRegistrationState("idle");
      setIsAuthoringOpen(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [autoRegistrationState]);
  const errorFor = (field) => visibleErrors[field] ? <span className="coding-field-error" id={`coding-error-${field}`} role="alert">{visibleErrors[field]}</span> : null;
  const requiredLabel = (label, field) => <span className="coding-field-label"><span>{label}</span>{visibleErrors[field] && <span className="required-mark">필수</span>}</span>;
  const tabStatus = (tab) => {
    if (tab.fields.some((field) => visibleErrors[field])) return "확인 필요";
    if (!tab.fields.some((field) => allErrors[field])) return "완료";
    return "";
  };
  const retryReferenceAnswer = async () => {
    if (autoRegistrationState === "answer-failed") setAutoRegistrationState("answer");
    activeAnswerRequestSignature.current = currentAnswerSignature;
    const succeeded = await requestAiReferenceAnswer(
      currentQuestionForm.current,
      () => referenceAnswerSignature(currentQuestionForm.current) === currentAnswerSignature,
    );
    if (succeeded) {
      generatedAnswerSignatureRef.current = currentAnswerSignature;
      setGeneratedAnswerSignature(currentAnswerSignature);
    }
    activeAnswerRequestSignature.current = "";
  };

  const openNewQuestion = () => {
    cancelQuestionEdit();
    setAutoRegistrationState("idle");
    setAssistantRequirements(null);
    setAiAuthoringComplete(false);
    setAiAuthoringResetNonce((current) => current + 1);
    setIsAuthoringOpen(true);
    window.setTimeout(() => document.getElementById("question-authoring-inline")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const openQuestionEditor = (question) => {
    setAutoRegistrationState("idle");
    editQuestion(question);
    setIsAuthoringOpen(true);
    window.setTimeout(() => document.getElementById("question-authoring-inline")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const enqueueQuestion = (requirements) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `question-job-${Date.now()}-${Math.random()}`;
    const title = String(requirements.scope ?? "").trim().split("\n")[0] || "새 자동 생성 문제";
    setGenerationQueue((current) => [...current, { id, title, requirements, status: "queued", stage: "queued", activity: "앞선 작업이 끝나면 자동으로 시작됩니다." }]);
    setAssistantRequirements(null);
    setIsAuthoringOpen(false);
  };
  const cancelGenerationJob = (id) => {
    if (generationAbortRef.current?.jobId === id) generationAbortRef.current.controller.abort();
    setGenerationQueue((current) => current.map((job) => job.id === id ? { ...job, status: "cancelled", activity: "작업을 중단했습니다." } : job));
  };
  const retryGenerationJob = (id) => setGenerationQueue((current) => current.map((job) => job.id === id ? { ...job, status: "queued", stage: "queued", activity: "대기열에 다시 추가했습니다.", error: "" } : job));
  const deleteGenerationJob = (id) => {
    if (generationAbortRef.current?.jobId === id) generationAbortRef.current.controller.abort();
    setGenerationQueue((current) => current.filter((job) => job.id !== id));
  };
  const closeAuthoring = () => { setAutoRegistrationState("idle"); setIsAuthoringOpen(false); };

  return <section id="question-management" className="data-panel form-panel coding-problem-form detail-management-panel">
    <div className="panel-heading"><div><h2>문제 관리</h2></div><div className="question-panel-actions"><button className="primary-button compact-button" type="button" onClick={openNewQuestion}><Plus size={16} /> 새 문제 만들기</button><button className="secondary-button compact-button" type="button" onClick={openPreview}><Eye size={16} /> 시험지 미리보기</button><BookOpen size={20} /></div></div>
    {message && <div className={`workspace-alert question-management-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}
    {generationQueue.length > 0 && <QuestionGenerationQueue jobs={generationQueue} onCancel={cancelGenerationJob} onRetry={retryGenerationJob} onDelete={deleteGenerationJob} />}
    {!isAuthoringOpen && autoRegistrationState !== "idle" && <AutoRegistrationProgress state={autoRegistrationState} onRetryGeneration={() => { setAutoRegistrationState("idle"); setIsAuthoringOpen(true); }} onRetryAnswer={retryReferenceAnswer} onRetryRegistration={() => setAutoRegistrationState("answer")} />}
    <div className="question-list"><div className="section-title-row"><h3>문제 목록</h3><span className="text-muted">{questions.length}개</span></div>{questions.map((question, index) => { const aiAuthored = question.aiAnalysis?.authoringSource === "AI_ASSISTANT"; return <article className={`question-list-row ${editingQuestionId === question.id ? "selected" : ""}`} key={question.id}><div><strong>{index + 1}. {question.type === "CODING" ? question.title : question.prompt}</strong><span>{aiAuthored && <em className="question-ai-source">AI 자동 생성</em>}{question.type === "CODING" ? `코딩 · 비공개 채점 케이스 ${question.hiddenTestCases?.length ?? 0}개` : `객관식 · 선택지 ${question.options?.length ?? 0}개`}</span></div><div className="question-row-actions">{question.type === "CODING" && <button className="secondary-button compact-button" type="button" onClick={() => openQuestionEditor(question)}><Pencil size={14} /> 문제 수정</button>}<button className="danger-button compact-button" type="button" onClick={() => setQuestionToDelete(question)}><Trash2 size={14} /> 삭제</button></div></article>; })}{!questions.length && <p className="empty-state">아직 등록된 문제가 없습니다. 새 문제 만들기 버튼으로 출제를 시작하세요.</p>}</div>
    {isAuthoringOpen && <section id="question-authoring-inline" className="question-authoring-inline-panel" aria-labelledby="question-authoring-title">
        <div className="question-authoring-inline-heading"><div><h2 id="question-authoring-title">{editingQuestionId ? "문제 수정" : "새 문제 만들기"}</h2><p>{editingQuestionId ? "문제 내용과 채점 조건을 검토하고 수정하세요." : "출제 도우미로 초안을 만든 뒤 문제 내용을 검토하고 수정하세요."}</p></div><button className="icon-button" type="button" aria-label="문제 작성 영역 닫기" onClick={closeAuthoring}><X size={20} /></button></div>
        {autoRegistrationState !== "idle" && <AutoRegistrationProgress state={autoRegistrationState} onRetryAnswer={retryReferenceAnswer} onRetryRegistration={() => { setAutoRegistrationState("answer"); }} />}
        {draftOffer && isCoding && <div className="coding-draft-offer" role="status"><div><strong>저장된 초안이 있습니다.</strong><span>{new Date(draftOffer.savedAt).toLocaleString("ko-KR")} 저장{draftOffer.assistantRequirements ? " · 출제 도우미 설정 포함" : ""}{draftOffer.omittedFileCount ? ` · 첨부 파일 ${draftOffer.omittedFileCount}개는 다시 첨부해야 합니다.` : ""}</span></div><div><button className="secondary-button compact-button" type="button" onClick={discardDraft}>버리기</button><button className="primary-button compact-button" type="button" onClick={restoreDraft}>복구</button></div></div>}
        <form onSubmit={submitQuestion} noValidate={isCoding}>
      <div className="coding-authoring-layout">
        <main className="coding-editor-column">
          <nav className="coding-editor-tabs" aria-label="문제 정보 편집 영역">
            {CODING_EDITOR_TABS.map((tab) => { const status = tabStatus(tab); return <button key={tab.id} id={`coding-editor-tab-${tab.id}`} type="button" role="tab" aria-selected={editorTab === tab.id} className={editorTab === tab.id ? "active" : ""} onClick={() => setEditorTab(tab.id)}><strong>{tab.label}</strong>{status && <em className={status === "확인 필요" ? "attention" : "complete"}>{status}</em>}</button>; })}
          </nav>
          <div className="coding-step-panel coding-editor-panel" role="tabpanel" aria-labelledby={`coding-editor-tab-${editorTab}`}>
            {editorTab === "problem" && <><section className="coding-editor-section"><h4>제목 및 언어</h4><label>{requiredLabel("문제 제목", "title")}<input id="coding-field-title" value={questionForm.title} aria-invalid={Boolean(visibleErrors.title)} aria-describedby={visibleErrors.title ? "coding-error-title" : undefined} onChange={(event) => updateForm("title", event.target.value)} placeholder="예: 두 수의 합" />{errorFor("title")}</label><fieldset className="coding-language-field" id="coding-field-languages" tabIndex="-1"><legend>{requiredLabel("사용 언어", "languages")}</legend><div className="language-options">{["Python", "Java", "C", "JavaScript"].map((language) => <label key={language}><input type="checkbox" checked={questionForm.languages.includes(language)} onChange={() => toggleCodingLanguage(language)} /> {language}</label>)}</div>{errorFor("languages")}</fieldset></section><section className="coding-editor-section"><h4>문제 본문</h4>{[["description", "문제 설명"], ["inputFormat", "입력 형식"], ["outputFormat", "출력 형식"], ["constraints", "제한"]].map(([field, label]) => <label key={field}>{requiredLabel(label, field)}<textarea id={`coding-field-${field}`} value={questionForm[field]} aria-invalid={Boolean(visibleErrors[field])} aria-describedby={visibleErrors[field] ? `coding-error-${field}` : undefined} onChange={(event) => updateForm(field, event.target.value)} />{errorFor(field)}</label>)}</section></>}
            {editorTab === "tests" && <><TestCaseEditor collection="publicExamples" cases={questionForm.publicExamples} addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateCodingTestCase} error={visibleErrors.publicExamples} /><TestCaseEditor collection="hiddenTestCases" cases={questionForm.hiddenTestCases} addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateCodingTestCase} error={visibleErrors.hiddenTestCases} /><details className="coding-advanced-settings" open={questionForm.judgeMode !== "EXACT"}><summary>채점 방식 <span>{questionForm.judgeMode === "EXACT" ? "기본 설정" : "추가 설정"}</span></summary><div><label>비교 방식<select value={questionForm.judgeMode} onChange={(event) => updateForm("judgeMode", event.target.value)}><option value="EXACT">정확히 일치</option><option value="IGNORE_WHITESPACE">공백·줄바꿈 무시</option><option value="NUMERIC_TOLERANCE">숫자 오차 허용</option><option value="CUSTOM">별도 채점 코드</option></select></label>{questionForm.judgeMode === "NUMERIC_TOLERANCE" && <label>허용 오차<input id="coding-field-numericTolerance" type="number" min="0" step="any" value={questionForm.numericTolerance} onChange={(event) => updateForm("numericTolerance", event.target.value)} />{errorFor("numericTolerance")}</label>}{questionForm.judgeMode === "CUSTOM" && <label>별도 채점 코드<textarea id="coding-field-customJudgeCode" className="code-editor" value={questionForm.customJudgeCode} onChange={(event) => updateForm("customJudgeCode", event.target.value)} />{errorFor("customJudgeCode")}</label>}</div></details></>}
          </div>
        </main>
        <aside className="coding-ai-workspace" aria-label="출제 도우미">
          <header><h3>{editingQuestionId ? "출제 도우미" : "출제 도우미로 문제 만들기"}</h3><p>{editingQuestionId ? "수정된 문제를 기준으로 모범 답안을 관리합니다." : "조건을 입력하면 문제와 모범 답안을 생성하고 시험에 자동 등록합니다."}</p></header>
          {!editingQuestionId && <ProblemCreationChatbot codingOnly autoFocus examId={examId} completed={aiAuthoringComplete} resetKey={aiAuthoringResetNonce} restoreKey={assistantRestoreNonce} restoredRequirements={assistantRequirements} onRequirementsChange={setAssistantRequirements} onEnqueue={enqueueQuestion} onApplyCoding={(form) => { setQuestionType("CODING"); setQuestionForm((current) => ({ ...current, ...form, aiAnalysis: { ...current.aiAnalysis, ...form.aiAnalysis, authoringSource: "AI_ASSISTANT" } })); setAiAuthoringComplete(true); setAutoRegistrationState("answer"); setEditorTab("problem"); setAiDraftApplyNonce((current) => current + 1); }} />}
          {editingQuestionId && <div className="coding-ai-edit-note">수정한 내용이 저장되면 최신 기준으로 답안을 다시 준비합니다.</div>}
          <AiReferenceAnswerEditor questionForm={questionForm} requestAiReferenceAnswer={retryReferenceAnswer} answerOutdated={answerOutdated} />
        </aside>
      </div>
      <div className="coding-form-actions coding-sticky-actions">{message && <div className={`coding-action-message ${messageType === "error" ? "error" : ""}`} role={messageType === "error" ? "alert" : "status"}>{message}</div>}<div className="coding-action-row"><div className="coding-bottom-statuses"><span className={`coding-draft-status ${draftStatus}`}>{draftStatus === "saving" ? "초안 저장 중…" : draftStatus === "saved" && draftSavedAt ? `${new Date(draftSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 초안 저장됨` : draftStatus === "failed" ? "초안 저장 실패" : "브라우저에 자동 저장"}</span><span className={`coding-answer-status ${referenceAnswerReady ? "ready" : answerState.status.toLowerCase()}`}>{answerState.status === "PROCESSING" ? "답안 준비 중" : referenceAnswerReady ? "답안 준비 완료" : answerOutdated ? "답안 다시 생성 필요" : answerState.status === "FAILED" || answerState.status === "BLOCKED" ? "답안 확인 필요" : "답안 준비 대기"}</span></div><div><button className="primary-button" type="submit" disabled={!hasValidationErrors && (!referenceAnswerReady || answerState.status === "PROCESSING")}><Save size={16} /> {editingQuestionId ? "수정 사항 저장" : "시험 문제 등록"}</button></div></div></div>
        </form>
    </section>}
  </section>;
}

function QuestionGenerationQueue({ jobs, onCancel, onRetry, onDelete }) {
  const runningCount = jobs.filter((job) => job.status === "running").length;
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  return <section className="question-generation-queue" aria-label="문제 자동 생성 대기열">
    <div className="section-title-row"><div><h3>문제 자동 생성 대기열</h3><p className="form-hint">각 요청을 한 건씩 순서대로 생성하고 자동 등록합니다.</p></div><span>{runningCount ? "1건 처리 중" : queuedCount ? `${queuedCount}건 대기` : "처리 완료"}</span></div>
    <div className="question-generation-jobs">{jobs.map((job, jobIndex) => {
      const generatingDone = ["answer", "registering", "complete"].includes(job.stage);
      const answerDone = ["registering", "complete"].includes(job.stage);
      const steps = [
        { label: "문제 자동 생성", status: generatingDone ? "complete" : job.stage === "generating" ? (job.status === "failed" ? "error" : job.status === "cancelled" ? "stopped" : "active") : "upcoming" },
        { label: "모범 답안 생성", status: answerDone ? "complete" : job.stage === "answer" ? (job.status === "failed" ? "error" : job.status === "cancelled" ? "stopped" : "active") : "upcoming" },
        { label: "시험 문제 자동 등록", status: job.stage === "complete" ? "complete" : job.stage === "registering" ? (job.status === "failed" ? "error" : job.status === "cancelled" ? "stopped" : "active") : "upcoming" },
      ];
      return <article className={`question-generation-job ${job.status}`} key={job.id}>
        <header><div><small>요청 {jobIndex + 1}</small><strong>{job.title}</strong><span>{job.status === "queued" ? "대기열에 추가됨" : job.status === "complete" ? "문제 목록에 등록 완료" : job.status === "failed" ? job.error : job.status === "cancelled" ? "작업이 중단되었습니다." : job.activity || "자동 생성 중"}</span></div><div className="question-generation-job-actions">{job.status === "running" && <button className="secondary-button compact-button" type="button" onClick={() => onCancel(job.id)}><X size={14} /> 중단</button>}{["failed", "cancelled"].includes(job.status) && <button className="secondary-button compact-button" type="button" onClick={() => onRetry(job.id)}><RotateCcw size={14} /> 재시도</button>}<button className="danger-button compact-button" type="button" onClick={() => onDelete(job.id)}><Trash2 size={14} /> 삭제</button></div></header>
        <ol>{steps.map((step, index) => <li className={step.status} key={step.label}><span>{step.status === "complete" ? <Check size={14} /> : step.status === "active" ? <LoaderCircle className="spin" size={14} /> : step.status === "error" || step.status === "stopped" ? <X size={14} /> : index + 1}</span><strong>{step.label}</strong></li>)}</ol>
      </article>;
    })}</div>
  </section>;
}

function AutoRegistrationProgress({ state, onRetryGeneration, onRetryAnswer, onRetryRegistration }) {
  const generationFailed = state === "generation-failed";
  const answerFailed = state === "answer-failed";
  const registrationFailed = state === "registration-failed";
  const generationComplete = !["generating", "generation-failed"].includes(state);
  const answerComplete = ["registering", "complete", "registration-failed"].includes(state);
  const registrationComplete = state === "complete";
  const steps = [
    { label: "문제 자동 생성", detail: generationFailed ? "문제를 생성하지 못했습니다. 입력 조건을 확인해 주세요." : generationComplete ? "생성한 문제를 작성란에 자동 적용했습니다." : "출제 조건을 분석하고 문제를 생성하고 있습니다.", status: generationFailed ? "error" : generationComplete ? "complete" : "active" },
    { label: "모범 답안 생성", detail: answerFailed ? "답안을 생성하지 못했습니다. 입력 내용은 그대로 보존됩니다." : answerComplete ? "언어별 모범 답안을 생성했습니다." : state === "answer" ? "AI가 문제를 분석하고 언어별 답안을 만들고 있습니다." : "문제 생성이 끝나면 자동으로 시작됩니다.", status: answerFailed ? "error" : answerComplete ? "complete" : state === "answer" ? "active" : "upcoming" },
    { label: "시험 문제 자동 등록", detail: registrationFailed ? "등록하지 못했습니다. 잠시 후 다시 시도해 주세요." : registrationComplete ? "시험 문제 목록에 등록했습니다." : state === "registering" ? "생성된 문제와 답안을 시험에 등록하고 있습니다." : "모범 답안이 준비되면 자동으로 등록됩니다.", status: registrationFailed ? "error" : registrationComplete ? "complete" : state === "registering" ? "active" : "upcoming" },
  ];
  return <section className={`auto-registration-progress ${state}`} role="status" aria-live="polite">
    <div className="auto-registration-progress-heading">
      <div><strong>{registrationComplete ? "문제 등록을 완료했습니다." : generationFailed || answerFailed || registrationFailed ? "자동 등록을 계속하려면 확인이 필요합니다." : "문제를 자동으로 등록하고 있습니다."}</strong><span>{registrationComplete ? "문제 목록에 새 문제가 추가되었습니다." : "다른 작업을 하더라도 생성과 등록은 계속 진행됩니다."}</span></div>
      {!generationFailed && !answerFailed && !registrationFailed && !registrationComplete && <LoaderCircle className="spin" size={22} />}
    </div>
    <ol>{steps.map((step, index) => <li className={step.status} key={step.label}><span className="auto-registration-step-icon">{step.status === "complete" ? <Check size={15} /> : step.status === "active" ? <LoaderCircle className="spin" size={15} /> : step.status === "error" ? <X size={15} /> : index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}</ol>
    {generationFailed && <button className="secondary-button compact-button" type="button" onClick={onRetryGeneration}><RotateCcw size={14} /> 작성 화면 다시 열기</button>}
    {answerFailed && <button className="secondary-button compact-button" type="button" onClick={onRetryAnswer}><RotateCcw size={14} /> 답안 생성 다시 시도</button>}
    {registrationFailed && <button className="secondary-button compact-button" type="button" onClick={onRetryRegistration}><RotateCcw size={14} /> 문제 등록 다시 시도</button>}
  </section>;
}

function ExamAutomationPanel({ questions, automationStatus, inviteLeadDraft, setInviteLeadDraft, isSavingInviteLead, saveInviteLeadMinutes, examScheduleDraft, setExamScheduleDraft, isSavingExamSchedule, saveExamSchedule, isStartingAutomation, isRetryingAutomation, retryExamAutomation, isUpdatingAutomationControl, pauseExamAutomation, resumeExamAutomation, cancelExamAutomation, automationControlMessage, openAutomationConfirm }) {
  const state = automationStatus?.state ?? {};
  const preview = automationStatus?.preview ?? {};
  const isPaused = Boolean(state.paused);
  const phase = automationPhaseFor({ phase: isPaused ? "PAUSED" : (state.phase ?? state.status) });
  const phaseKey = String(state.phase ?? state.status ?? "").trim().toUpperCase();
  const questionCount = Number(preview.questionCount ?? automationStatus?.exam?.questionCount ?? questions.length) || 0;
  const registeredCount = Number(state.totalCandidateCount ?? preview.totalCandidateCount ?? 0) || 0;
  const eligibleCount = Number(state.eligibleCandidateCount ?? preview.eligibleCandidateCount ?? 0) || 0;
  const assignedCount = Number(state.assignedCandidateCount ?? preview.assignedCandidateCount ?? 0) || 0;
  const excludedCount = Number(state.excludedCandidateCount ?? preview.excludedCandidateCount ?? 0) || 0;
  const locked = AUTOMATION_LOCKED_PHASES.has(phaseKey);
  const canStart = questionCount > 0 && eligibleCount > 0 && !(state.managedByAgent && !AUTOMATION_RETRYABLE_PHASES.has(phaseKey));
  const canRetry = AUTOMATION_RETRYABLE_PHASES.has(phaseKey);
  const excluded = Array.isArray(state.excludedCandidates) && state.excludedCandidates.length
    ? state.excludedCandidates
    : (Array.isArray(preview.excludedCandidates) ? preview.excludedCandidates : []);
  const expectedInvitationAt = computeExpectedInvitationAt(examScheduleDraft || automationStatus?.exam?.startsAt || state.startsAt, inviteLeadDraft)
    ?? state.invitationScheduledAt
    ?? null;
  const executionLogs = automationExecutionLogs(automationStatus);
  const workflowStages = [
    ["prepare", "대상 배정"], ["invite", "초대 발송"], ["exam", "시험 진행"],
    ["finalize", "응시 마감"], ["grade", "자동 채점"], ["result", "결과 안내"],
  ];
  const phaseStageIndexes = {
    ASSIGNING: 0, WAITING_INVITATION: 1, INVITING: 1, INVITATION_FAILED: 1,
    WAITING_EXAM: 2, FINALIZING: 3, GRADING: 4, GRADING_FAILED: 4, REPORTING: 4,
    EMAIL_PENDING: 5, EMAIL_SENDING: 5, EMAIL_FAILED: 5, COMPLETED: 6,
  };
  const currentStageIndex = state.managedByAgent ? (phaseStageIndexes[phaseKey] ?? 0) : -1;
  const activityDescriptions = {
    ASSIGNING: "초대 가능한 응시자를 확인하고 시험 대상자로 배정하고 있습니다.",
    WAITING_INVITATION: `설정한 시각까지 대기한 뒤 ${eligibleCount}명에게 초대를 발송합니다.`,
    INVITING: `${eligibleCount}명의 초대 링크와 안내 메일을 만들고 있습니다.`,
    WAITING_EXAM: "초대 발송을 마쳤습니다. 시험 시작과 응시 상태를 기다리고 있습니다.",
    FINALIZING: "시험 종료 시각을 기준으로 제출과 결시 상태를 확정하고 있습니다.",
    GRADING: "제출된 답안을 채점하고 응시자별 결과를 만들고 있습니다.",
    REPORTING: "채점 결과를 바탕으로 결과 안내를 준비하고 있습니다.",
    EMAIL_SENDING: "확정된 결과를 응시자에게 발송하고 있습니다.",
    COMPLETED: "배정부터 결과 안내까지 모든 자동 운영 작업을 마쳤습니다.",
  };
  const currentActivity = isPaused
    ? "진행 중인 단계가 보존되어 있습니다. 운영 재개를 누르면 현재 단계부터 이어갑니다."
    : state.failureReason
      ? localizeAutomationFailure(state.failureReason)
      : activityDescriptions[phaseKey] ?? (state.managedByAgent ? "다음 자동 운영 작업을 확인하고 있습니다." : "문제와 응시자를 확인한 뒤 자동 운영을 시작할 수 있습니다.");
  return <section className="exam-automation-panel" aria-labelledby="exam-automation-title">
    <div className="section-title-row exam-automation-heading">
      <div>
        <h3 id="exam-automation-title">자동 시험 운영</h3>
        <p className="form-hint">문제 작성 후 초대 가능한 응시자를 자동 배정하고 초대·채점·결과 안내를 처리합니다.</p>
      </div>
      <div className="exam-automation-heading-actions">
        {!state.managedByAgent && <button className="primary-button compact-button" type="button" onClick={openAutomationConfirm} disabled={!canStart || isStartingAutomation}>{isStartingAutomation ? <LoaderCircle className="spin" size={14} /> : <CheckSquare size={14} />} 자동 시험 운영 시작</button>}
        {state.managedByAgent && phaseKey !== "COMPLETED" && <>{isPaused ? <button className="primary-button compact-button" type="button" onClick={resumeExamAutomation} disabled={isUpdatingAutomationControl}>{isUpdatingAutomationControl ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} 운영 재개</button> : <button className="secondary-button compact-button" type="button" onClick={pauseExamAutomation} disabled={isUpdatingAutomationControl}>{isUpdatingAutomationControl ? <LoaderCircle className="spin" size={14} /> : <Clock size={14} />} 일시정지</button>}<button className="danger-button compact-button" type="button" onClick={cancelExamAutomation} disabled={isUpdatingAutomationControl}><X size={14} /> 운영 취소</button></>}
      </div>
    </div>
    {automationControlMessage && <div className={`workspace-alert automation-control-message ${automationControlMessage.type === "error" ? "error" : ""}`} role={automationControlMessage.type === "error" ? "alert" : "status"}>{automationControlMessage.text}</div>}
    <section className={`automation-agent-overview${isPaused ? " paused" : ""}`} aria-label="자동 운영 현재 작업">
      <div className="automation-agent-current">
        <span className="automation-agent-pulse" aria-hidden="true" />
        <div><small>{isPaused ? "AGENT PAUSED" : state.managedByAgent ? "AGENT RUNNING" : "AGENT READY"}</small><h4>{isPaused ? "운영 일시정지" : phase.label}</h4><p>{currentActivity}</p></div>
      </div>
      <ol className="automation-workflow-steps">
        {workflowStages.map(([id, label], index) => <li key={id} className={index < currentStageIndex ? "complete" : index === currentStageIndex ? "current" : "upcoming"}><span>{index < currentStageIndex ? <Check size={13} /> : index + 1}</span><strong>{label}</strong></li>)}
      </ol>
    </section>
    <div className="exam-automation-metrics">
      <AutomationMetric label="저장된 문제" value={`${questionCount}개`} />
      <AutomationMetric label="등록 응시자" value={`${registeredCount}명`} />
      <AutomationMetric label="초대 가능" value={`${eligibleCount}명`} tone="success" />
      <AutomationMetric label="자동 배정" value={`${assignedCount}명`} />
      <AutomationMetric label="제외 대상" value={`${excludedCount}명`} tone={excludedCount ? "warning" : ""} />
    </div>
    <div className="automation-operation-row">
      <div className="exam-schedule-control-panel">
        <div><strong>시험 시작 일시</strong><span>자동 배정과 초대 발송의 기준 시간입니다.</span></div>
        <div className="exam-schedule-control-row"><input type="datetime-local" aria-label="시험 시작 일시" value={examScheduleDraft} onChange={(event) => setExamScheduleDraft(event.target.value)} disabled={isSavingExamSchedule} /><button className="secondary-button compact-button" type="button" onClick={saveExamSchedule} disabled={!examScheduleDraft || isSavingExamSchedule}>{isSavingExamSchedule ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} 일정 저장</button></div>
      </div>
      <div className="exam-automation-controls">
        <label className="invite-lead-field"><span className="automation-control-label">초대 발송 시점</span>
          <span className="invite-lead-control"><span className="invite-lead-stepper"><button type="button" aria-label="초대 발송 시점 10분 줄이기" onClick={() => setInviteLeadDraft(String(Math.max(0, (Number(inviteLeadDraft) || 0) - 10)))} disabled={locked || isSavingInviteLead}>−</button><input type="number" inputMode="numeric" aria-label="시험 시작 전 초대 발송 시간(분)" min="0" max="10080" step="1" value={inviteLeadDraft} onChange={(event) => setInviteLeadDraft(event.target.value)} disabled={locked || isSavingInviteLead} /><button type="button" aria-label="초대 발송 시점 10분 늘리기" onClick={() => setInviteLeadDraft(String(Math.min(10080, (Number(inviteLeadDraft) || 0) + 10)))} disabled={locked || isSavingInviteLead}>+</button></span><span>분 전</span></span>
        </label>
        <div className="automation-schedule-summary">
          <span className="automation-control-label">예상 발송 시각</span>
          <span className="automation-schedule-value"><strong>{formatAutomationScheduledAt(expectedInvitationAt)}</strong><small>{expectedInvitationAt ? formatAutomationLeadTime(expectedInvitationAt) : "시간 미정"}</small></span>
        </div>
        <div className="invite-lead-save">
          <span className="automation-control-label">설정 적용</span>
          <button className="secondary-button compact-button" type="button" onClick={() => saveInviteLeadMinutes().catch(() => {})} disabled={locked || isSavingInviteLead}>
            {isSavingInviteLead ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} 발송 시점 저장
          </button>
        </div>
        <small className="form-hint invite-lead-hint">{locked ? "현재 자동 운영 단계를 마친 뒤 수정할 수 있습니다." : "변경하면 기존 초대는 폐기되고 새 일정에 맞춰 다시 발송됩니다."}</small>
      </div>
    </div>
    <section className="automation-assignment-overview" aria-label="자동 배정 및 제외 대상 현황">
      <div className="automation-assignment-overview-heading">
        <div><h4>운영 대상 현황</h4><p>{automationStatus?.exam?.startsAt ? `예정 시험 시작: ${formatAutomationScheduledAt(automationStatus.exam.startsAt)}` : "예정 시험 시작: 일정 미정"}</p></div>
        <div className="automation-assignment-summary"><span><small>자동 배정</small><strong>{assignedCount}/{eligibleCount}명</strong></span><span className={excludedCount ? "warning" : ""}><small>제외 대상</small><strong>{excludedCount}명</strong></span>{canRetry && <button className="secondary-button compact-button" type="button" onClick={retryExamAutomation} disabled={isRetryingAutomation}>{isRetryingAutomation ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} 실패 단계 재시도</button>}</div>
      </div>
      <div className="automation-exclusion-section"><h5>제외 대상과 사유</h5><div className="automation-exclusion-scroll">{excluded.length ? excluded.map((item, index) => <div className="automation-exclusion-item" key={`${item.candidateId || item.candidateName || item.candidateNumber}-${index}`}><strong>{item.candidateName || item.candidateNumber || "응시자"}</strong><span>{(Array.isArray(item.reasons) ? item.reasons : [item.reason]).filter(Boolean).map(localizePreviewExclusionReason).join(" · ")}</span></div>) : <p>현재 제외 대상이 없습니다.</p>}</div></div>
    </section>
    {state.failureReason && <div className="workspace-alert error automation-detail-failure"><strong>{phase.label}</strong><span>{localizeAutomationFailure(state.failureReason)}</span></div>}
    <section className="automation-execution-log" aria-labelledby="automation-execution-log-title">
      <div className="section-title-row">
        <div><h4 id="automation-execution-log-title">실행 로그</h4><p className="form-hint">자동 운영 단계가 3초마다 갱신됩니다.</p></div>
        <span>{executionLogs.length}건</span>
      </div>
      {executionLogs.length ? <ol>{executionLogs.map((log, index) => <li key={log.id} className={`${log.tone}${index === 0 ? " latest" : ""}`}><span className="automation-log-marker" aria-hidden="true" /><time dateTime={log.at}>{index === 0 && <b>최근 활동</b>}{new Date(log.at).toLocaleString("ko-KR")}</time><div><strong>{log.title}</strong>{log.detail && <span>{log.detail}</span>}</div></li>)}</ol> : <p className="empty-state">아직 실행 기록이 없습니다.</p>}
    </section>
    {!state.managedByAgent && !canStart && <div className="exam-automation-actions">
      <span className="exam-automation-action-hint">
        {!questionCount
          ? "문제를 1개 이상 저장해야 자동 운영을 시작할 수 있습니다."
          : !eligibleCount
            ? "초대 가능한 응시자가 있어야 자동 운영을 시작할 수 있습니다."
            : "자동 운영 시작 조건을 확인해 주세요."}
      </span>
    </div>}
  </section>;
}

function automationExecutionLogs(automationStatus) {
  const state = automationStatus?.state ?? {};
  const candidateStates = Array.isArray(automationStatus?.candidates) ? automationStatus.candidates : [];
  const candidateStatusLabels = {
    PENDING: "마감 처리 대기", FINALIZING: "응시 상태 확인 중", GRADING: "AI 답안 채점 중", GRADING_FAILED: "자동 채점 실패",
    REVIEW_REQUIRED: "관리자 검토 필요", EMAIL_PENDING: "결과 메일 대기", EMAIL_FAILED: "결과 메일 실패",
    COMPLETED: "처리 완료", FINALIZED: "시험 종료 처리", ABSENT: "결시 처리", EXCLUDED: "자동 운영 제외",
  };
  const logs = [];
  const add = (id, at, title, detail = "", tone = "") => {
    if (!at || Number.isNaN(Date.parse(at))) return;
    logs.push({ id, at, title, detail, tone });
  };
  add("started", state.startedAt, "자동 시험 운영 시작", `${Number(state.eligibleCandidateCount ?? 0)}명 처리 대상`);
  add("paused", state.pausedAt, "자동 시험 운영 일시정지");
  add("resumed", state.resumedAt, "자동 시험 운영 재개");
  add("cancelled", state.cancelledAt, "자동 시험 운영 취소", "이후 자동 처리를 중단했습니다.", "error");
  add("invitation-scheduled", state.startedAt, "초대 발송 예약", `${formatAutomationScheduledAt(state.invitationScheduledAt)} · 시험 시작 ${Number(state.inviteLeadMinutes ?? 0)}분 전`, "scheduled");
  add("invitation-sent", state.invitationSentAt, "초대 발송 처리", `${Number(state.invitationCreatedCount ?? 0)}건 생성 · ${Number(state.invitationReusedCount ?? 0)}건 재사용`);
  const phaseKey = String(state.phase ?? state.status ?? "").toUpperCase();
  const finishedStatuses = new Set(["COMPLETED", "FINALIZED", "ABSENT", "EXCLUDED", "REVIEW_REQUIRED", "GRADING_FAILED", "EMAIL_FAILED"]);
  const finishedCount = candidateStates.filter((candidate) => finishedStatuses.has(candidate.status)).length;
  const activeCandidate = candidateStates.find((candidate) => ["FINALIZING", "GRADING", "EMAIL_PENDING"].includes(candidate.status));
  const phaseDetail = phaseKey === "FINALIZING"
    ? `${finishedCount}/${Number(state.candidateCount ?? candidateStates.length)}명 완료${activeCandidate ? ` · 현재 ${activeCandidate.candidateName || "응시자"} 처리 중` : " · 마감 대상 확인 중"}`
    : automationPhaseFor({ phase: state.phase ?? state.status }).label;
  const completedAtMs = Date.parse(state.completedAt ?? "");
  const lastRunAtMs = Date.parse(state.lastRunAt ?? "");
  const hasPostCompletionRun = Number.isFinite(completedAtMs) && Number.isFinite(lastRunAtMs) && lastRunAtMs > completedAtMs;
  if (!(state.status === "COMPLETED" && hasPostCompletionRun)) {
    add("last-run", state.lastRunAt, "자동 운영 단계 실행", phaseDetail);
  }
  add("failed", state.lastFailureAt, "자동 운영 오류", localizeAutomationFailure(state.failureReason ?? state.failureCode), "error");
  add("completed", state.completedAt, "자동 시험 운영 완료", `${Number(state.finalizedCount ?? 0)}명 처리 완료`, "success");
  for (const candidate of candidateStates) {
    const name = candidate.candidateName || candidate.candidateEmail || "응시자";
    add(`candidate-queued-${candidate.candidateId}`, candidate.queuedAt, `${name} 처리 대기`);
    const activeDetails = {
      CHECKING_ATTENDANCE: "접속·제출 여부와 결시 처리 조건을 확인하고 있습니다.",
      SUBMITTING_ANSWERS: "제출되지 않은 답안을 마감 시각 기준으로 확정하고 있습니다.",
      AI_GRADING: "코딩 답안을 AI로 채점하고 있습니다. 공급자 응답은 1회 최대 60초까지 기다립니다.",
      EMAIL_PENDING: "채점 결과 메일 발송 순서를 기다리고 있습니다.",
    };
    if (["PENDING", "FINALIZING", "GRADING", "EMAIL_PENDING"].includes(candidate.status)) {
      add(`candidate-active-${candidate.candidateId}`, candidate.updatedAt ?? candidate.processingStartedAt ?? state.lastRunAt, `${name}: ${candidateStatusLabels[candidate.status]}`, activeDetails[candidate.processingStep] ?? "이 응시자의 다음 처리 단계를 준비하고 있습니다.", "scheduled");
    } else {
      add(`candidate-finalized-${candidate.candidateId}`, candidate.finalizedAt ?? candidate.updatedAt, `${name} 처리`, candidate.failureReason || candidateStatusLabels[candidate.status] || "처리 완료", candidate.failureReason ? "error" : "");
    }
  }
  for (const delivery of Array.isArray(automationStatus?.deliveries) ? automationStatus.deliveries : []) {
    add(`delivery-${delivery.id}`, delivery.sentAt, `${delivery.candidateName || "응시자"} 결과 메일 발송`, "발송 완료", "success");
  }
  return logs.sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 100);
}

function AutomationMetric({ label, value, tone = "" }) {
  return <div className={`automation-summary-stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function AiReferenceAnswerEditor({ questionForm, requestAiReferenceAnswer, answerOutdated }) {
  const answerState = questionForm.aiAnalysis.referenceAnswer ?? { status: "NOT_RUN", generatedAt: "" };
  const languages = questionForm.languages?.length ? questionForm.languages : [];
  const statusLabels = { NOT_RUN: "생성 전", PROCESSING: "생성 중", GENERATED: "생성 완료", BLOCKED: "조건 확인 필요", FAILED: "생성 실패" };
  const hasGeneratedAnswer = languages.some((language) => String(questionForm.referenceSolutions?.[language] ?? "").trim());
  return <section className="ai-reference-answer-section">
    <div className="section-title-row">
      <div>
        <h3>모범 답안</h3>
        <p className="form-hint">문제 내용을 수정한 경우 답안을 다시 생성해 주세요.</p>
      </div>
      <span className={`ai-validation-status ${answerState.status.toLowerCase()}`}>{statusLabels[answerState.status] ?? "생성 전"}</span>
    </div>
    <div className="ai-reference-answer-actions">
      <button className="secondary-button" type="button" onClick={requestAiReferenceAnswer} disabled={answerState.status === "PROCESSING" || !questionForm.title.trim() || !questionForm.description.trim() || languages.length === 0}>
        <CheckSquare size={16} /> {answerState.status === "PROCESSING" ? "모범 답안 생성 중..." : hasGeneratedAnswer ? "모범 답안 다시 생성" : "모범 답안 생성"}
      </button>
      <span className="form-hint">AI 시안 적용 직후에는 자동 생성되며, 직접 수정한 뒤에는 다시 생성해야 합니다.</span>
    </div>
    {answerOutdated && <div className="ai-reference-feasibility-warning caution" role="alert"><strong>문제에 수정사항이 있습니다.</strong><p>현재 모범 답안이 수정된 문제와 다를 수 있습니다. 내용을 확인한 뒤 모범 답안을 다시 생성해 주세요.</p></div>}
    {answerState.status === "BLOCKED" && <div className="ai-reference-feasibility-warning" role="alert"><strong>현재 조건으로 모범 답안을 생성할 수 없습니다.</strong><p>{answerState.feasibilityMessage}</p>{answerState.warnings.length > 0 && <ul>{answerState.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</div>}
    {answerState.status === "FAILED" && <div className="ai-reference-feasibility-warning" role="alert"><strong>{answerState.errorMessage || "모범 답안 생성에 실패했습니다."}</strong>{answerState.errorDetail && <p>상세 원인: {answerState.errorDetail}</p>}{(answerState.providerStatus || answerState.errorCode) && <small>오류 코드: {[answerState.providerStatus && `HTTP ${answerState.providerStatus}`, answerState.errorCode].filter(Boolean).join(" / ")}</small>}{!answerState.errorDetail && <p>잠시 후 다시 시도해 주세요. 문제가 계속되면 시스템 관리자에게 문의해 주세요.</p>}</div>}
    {answerState.status === "GENERATED" && answerState.warnings.length > 0 && <div className="ai-reference-feasibility-warning caution"><strong>생성 전제 확인</strong><ul>{answerState.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    {hasGeneratedAnswer ? <div className="ai-generated-answer-list">
      <div className="ai-generated-answer-heading"><strong>생성된 답안 확인</strong><span>언어별 카드를 눌러 답안 내용을 확인하세요.</span></div>
      {languages.map((language) => {
        const source = String(questionForm.referenceSolutions?.[language] ?? "").trim();
        return source ? <details className="ai-generated-answer" key={language}>
          <summary><strong>{language}</strong><span className="ai-generated-answer-controls"><span className="ai-language-success"><Check size={14} /> 생성 완료</span><span className="ai-answer-toggle-label"><Eye size={14} /><b className="when-closed">답안 보기</b><b className="when-open">답안 닫기</b></span></span></summary>
          <pre>{source}</pre>
        </details> : null;
      })}
    </div> : <p className="empty-state">아직 생성된 모범 답안이 없습니다.</p>}
    <p className="form-hint">생성된 답안은 출제자 검토와 AI 채점 참고용이며 응시자에게 공개되지 않습니다. 실제 점수는 비공개 채점 케이스 결과를 기준으로 합니다.</p>
  </section>;
}

function TestCaseEditor({ collection, cases, addTestCase, removeTestCase, updateTestCase, error }) {
  const isPublic = collection === "publicExamples";
  return <section className="coding-test-section" id={`coding-field-${collection}`} tabIndex="-1"><div className="section-title-row"><div><h3>{isPublic ? "공개 예제" : "비공개 채점 케이스"} {error && <span className="required-mark">필수</span>}</h3><p className="form-hint">{isPublic ? "응시자에게 표시되는 예제입니다." : "실제 채점에만 사용하며 응시자에게 공개하지 않습니다."}</p></div><button className="secondary-button compact-button" type="button" onClick={() => addTestCase(collection)}>추가</button></div>{error && <span className="coding-field-error" role="alert">{error}</span>}{cases.map((testCase, index) => <div className="test-case-card" key={`${collection}-${index}`}><div className="section-title-row"><strong>{isPublic ? "예제" : "채점 케이스"} {index + 1}</strong>{cases.length > 1 && <button className="text-button" type="button" onClick={() => removeTestCase(collection, index)}>삭제</button>}</div><label>입력<textarea value={testCase.input} onChange={(event) => updateTestCase(collection, index, "input", event.target.value)} /></label><label>기대 출력<textarea value={testCase.expectedOutput} onChange={(event) => updateTestCase(collection, index, "expectedOutput", event.target.value)} /></label>{isPublic && <label>설명 <span className="text-muted">(선택)</span><input value={testCase.explanation} onChange={(event) => updateTestCase(collection, index, "explanation", event.target.value)} /></label>}</div>)}</section>;
}

function PreviewDetail({ title, content }) {
  if (!content) return null;
  return <section className="exam-preview-detail"><strong>{title}</strong><p>{content}</p></section>;
}
