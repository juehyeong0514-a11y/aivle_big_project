import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  Copy,
  Eye,
  ExternalLink,
  FileUp,
  Mail,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage, authHeaders } from "../api/client";
import { getExamCandidateScope } from "./candidateScope.mjs";
import {
  codingDraftKey,
  hasMeaningfulCodingDraft,
  parseCodingDraft,
  serializeCodingDraft,
  validateCodingProblem,
} from "./codingProblemWorkflow.mjs";
import ProblemCreationChatbot from "./ProblemCreationChatbot.jsx";

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
  if (invalidRow >= 0) throw new Error(`CSV ${invalidRow + 2}행을 확인해주세요. 이름, 이메일, 실제 생년월일이 모두 필요합니다.`);
  return candidates;
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
  const [activeManagementPanel, setActiveManagementPanel] = useState("questions");
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

  const load = useCallback(async () => {
    const [examResponse, candidateResponse, examCandidateResponse, questionResponse, invitationResponse, identityRequestResponse] =
      await Promise.all([
        api.get("/manager/exams", headers),
        api.get("/manager/candidates", headers),
        api.get(`/manager/exams/${examId}/candidates`, headers),
        api.get(`/manager/exams/${examId}/questions`, headers),
        api.get("/manager/invitations", headers),
        api.get(`/manager/exams/${examId}/identity-verification-requests`, headers),
      ]);
    setExam(examResponse.data.find((item) => item.id === examId) || null);
    setCandidates(examCandidateResponse.data);
    setOrganizationCandidates(candidateResponse.data);
    setQuestions(questionResponse.data);
    setIdentityVerificationRequests(identityRequestResponse.data);
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
    setSelectedCandidateIds((current) =>
      current.filter((candidateId) =>
        examCandidateResponse.data.some(
          (candidate) => candidate.id === candidateId,
        ),
      ),
    );
  }, [examId, headers]);

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const startEditingExamTitle = () => {
    setExamTitleDraft(exam.title);
    setIsEditingExamTitle(true);
  };

  const saveExamTitle = async () => {
    const title = examTitleDraft.trim();
    if (!title) return showMessage("시험 제목을 입력해주세요.", "error");
    if (title.length > 100) return showMessage("시험 제목은 100자 이하로 입력해주세요.", "error");
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
          referenceAnswer: { ...current.aiAnalysis.referenceAnswer, status: "GENERATED", generatedAt: data.generatedAt ?? "", feasibilityMessage: "", errorMessage: "", warnings: data.warnings ?? [], provider: data.provider ?? "", model: data.model ?? "" },
        },
      }));
      showMessage("입력한 문제 정보를 바탕으로 AI 모범 답안을 생성했습니다.");
      return true;
    } catch (reason) {
      if (!isCurrent()) return false;
      const errorMessage = apiErrorMessage(reason, reason?.message || "AI 모범 답안 생성에 실패했습니다.");
      setQuestionForm((current) => ({
        ...current,
        aiAnalysis: {
          ...current.aiAnalysis,
          referenceAnswer: { ...current.aiAnalysis.referenceAnswer, status: "FAILED", errorMessage },
        },
      }));
      showMessage(errorMessage, "error");
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
    const isCoding = question.type === "CODING";
    setQuestionType(isCoding ? "CODING" : "MULTIPLE_CHOICE");
    if (isCoding) setQuestionForm(questionToForm(question));
    else setMultipleChoiceForm({ prompt: question.prompt ?? "", options: question.options?.length ? question.options : ["", ""], answer: question.answer ?? "" });
    setEditingQuestionId(question.id);
    showMessage(`“${question.title}” 문제를 수정 중입니다.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelQuestionEdit = () => {
    setQuestionForm(initialCodingProblem());
    setMultipleChoiceForm(initialMultipleChoiceQuestion());
    setQuestionType("CODING");
    setEditingQuestionId("");
    showMessage("새 코딩 문제 등록으로 전환했습니다.");
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
        { ...candidateForm, email: normalizedEmail, organizationId: exam.organizationId },
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
      showMessage(`${uploadableCandidates.length}명을 등록했습니다.${remainingCandidates.length ? ` ${remainingCandidates.length}명은 오류를 확인해주세요.` : ""}`);
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
      showMessage("신분 인증을 위해 생년월일이 없는 응시자의 정보를 먼저 수정해주세요.", "error");
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
          "초대 링크를 복사하지 못했습니다. 아래 링크를 직접 선택해 복사해주세요.", "error",
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
      showMessage("배정된 대상자를 먼저 선택해주세요.", "error");
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
          <span className="workspace-eyebrow">EXAM DETAIL</span>
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
      <nav className="exam-detail-tabs" aria-label="시험 운영">
        <button
          className={`exam-detail-tab ${activeManagementPanel === "questions" ? "active" : ""}`}
          type="button"
          aria-pressed={activeManagementPanel === "questions"}
          onClick={() => { setActiveManagementPanel("questions"); setMessage(""); }}
        >
          <span className="exam-detail-tab-label"><BookOpen size={19} /> 문제 생성 및 미리보기</span>
          <span className="exam-detail-tab-count">문제 {questions.length}개</span>
        </button>
        <button
          className={`exam-detail-tab ${activeManagementPanel === "candidates" ? "active" : ""}`}
          type="button"
          aria-pressed={activeManagementPanel === "candidates"}
          onClick={() => { setActiveManagementPanel("candidates"); setMessage(""); }}
        >
          <span className="exam-detail-tab-label"><Users size={19} /> 응시자 운영</span>
          <span className="exam-detail-tab-count">
            등록 {examCandidateScope.count} · 초대 {invitedCandidateIds.length}
          </span>
        </button>
        <button
          className={`exam-detail-tab ${activeManagementPanel === "identity" ? "active" : ""}`}
          type="button"
          aria-pressed={activeManagementPanel === "identity"}
          onClick={() => setActiveManagementPanel("identity")}
        >
          <span className="exam-detail-tab-label"><CheckSquare size={19} /> 대체 신원확인</span>
          <span className="exam-detail-tab-count">대기 {identityVerificationRequests.filter((item) => item.status === "PENDING").length}건</span>
        </button>
      </nav>

      {activeManagementPanel === "questions" && <QuestionManagement
        examId={examId}
        message={message} messageType={messageType}
        questionType={questionType} setQuestionType={setQuestionType} questionForm={questionForm} setQuestionForm={setQuestionForm}
        editingQuestionId={editingQuestionId} createQuestion={createQuestion}
        addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateTestCase} toggleLanguage={toggleLanguage}
        cancelQuestionEdit={cancelQuestionEdit} questions={questions} editQuestion={editQuestion} setQuestionToDelete={setQuestionToDelete}
        openPreview={() => setIsExamPreviewOpen(true)} requestAiReferenceAnswer={requestAiReferenceAnswer} />}

      {activeManagementPanel === "candidates" && (
        <div className="candidate-operations-layout">
        <form
          id="candidate-management"
          className="data-panel form-panel detail-management-panel"
          onSubmit={createCandidate}
        >
          <div className="panel-heading">
            <div>
              <h2>응시자 등록</h2>
              <p>개별 또는 CSV로 등록하면 오른쪽 운영 현황에 바로 추가됩니다.</p>
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
            <p>등록 정보와 배정·초대 상태를 확인하고 필요한 작업을 바로 처리하세요.</p>
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
            <span>{selectedCandidateIds.length}명 선택됨</span>
            <div className="floating-action-buttons">
              {selectedCandidateIds.length > 0 && (
                <span className="action-hint">
                  <CheckSquare size={14} /> 배정 해제해도 응시자 등록 정보는 삭제되지 않습니다.
                </span>
              )}
              <button className="primary-button" type="button" onClick={sendInvitations} disabled={selectedCandidateIds.length === 0}><Mail size={16} /> 선택 대상자 배정 및 초대</button>
              <button className="danger-button" type="button" disabled={!selectedAssignedCount} onClick={removeAssignments}><Trash2 size={16} /> 선택 대상자 배정 해제</button>
            </div>
          </div>
        </div>
        {mailPreviews.length > 0 && (
          <div className="mail-preview">
            <strong>방금 생성한 초대 링크</strong>
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
      )}

      {activeManagementPanel === "identity" && (
        <section id="identity-management" className="data-panel detail-management-panel">
          <div className="panel-heading">
            <div>
              <h2>신분증 미소지자 대체 신원확인</h2>
              <p>기관이 사전 등록한 이름·응시번호 명단을 확인한 뒤 승인 또는 반려하세요.</p>
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
      )}

      {isExamPreviewOpen && (
        <div className="exam-preview-modal" role="dialog" aria-modal="true" aria-labelledby="exam-preview-title">
          <button className="exam-preview-backdrop" type="button" aria-label="시험지 미리보기 닫기" onClick={() => setIsExamPreviewOpen(false)} />
          <section className="exam-preview-panel">
            <header className="exam-preview-heading">
              <div>
                <span className="workspace-eyebrow"><Eye size={14} /> APPLICANT VIEW</span>
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
        <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-question-title">
          <button className="confirm-modal-backdrop" type="button" aria-label="삭제 취소" onClick={() => setQuestionToDelete(null)} />
          <section className="confirm-modal-panel"><h2 id="delete-question-title">문제를 삭제할까요?</h2><p><strong>{questionToDelete.type === "CODING" ? questionToDelete.title : questionToDelete.prompt}</strong>은(는) 되돌릴 수 없습니다. 초대 발송 후에는 문제를 삭제할 수 없습니다.</p><div className="confirm-modal-actions"><button className="secondary-button" type="button" onClick={() => setQuestionToDelete(null)}>취소</button><button className="danger-button" type="button" onClick={confirmQuestionDelete}><Trash2 size={16} /> 삭제</button></div></section>
        </div>
      )}
    </section>
  );
}

const CODING_EDITOR_TABS = [
  { id: "problem", label: "문제 작성", fields: ["title", "languages", "description", "inputFormat", "outputFormat", "constraints"] },
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


function QuestionManagement({ examId, message, messageType, questionType, setQuestionType, questionForm, setQuestionForm, editingQuestionId, createQuestion, addTestCase, removeTestCase, updateTestCase, toggleLanguage, questions, editQuestion, setQuestionToDelete, openPreview, requestAiReferenceAnswer }) {
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
  const [isAuthoringOpen, setIsAuthoringOpen] = useState(true);
  const [aiDraftApplyNonce, setAiDraftApplyNonce] = useState(0);
  const [aiAuthoringComplete, setAiAuthoringComplete] = useState(false);
  const [generatedAnswerSignature, setGeneratedAnswerSignature] = useState("");
  const generatedAnswerSignatureRef = useRef("");
  const draftKey = codingDraftKey(examId, editingQuestionId);
  const blockedDraftKeys = useRef(new Set());
  const draftBaselines = useRef(new Map());
  const currentQuestionForm = useRef(questionForm);
  currentQuestionForm.current = questionForm;
  const requestAiReferenceAnswerRef = useRef(requestAiReferenceAnswer);
  requestAiReferenceAnswerRef.current = requestAiReferenceAnswer;
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
    if (editingQuestionId) setIsAuthoringOpen(true);
  }, [editingQuestionId]);

  useEffect(() => {
    setVisibleErrors({});
    setEditorTab("problem");
    setAiAuthoringComplete(false);
    setDraftOffer(null);
    const form = currentQuestionForm.current;
    const existingSignature = form.aiAnalysis.referenceAnswer?.status === "GENERATED"
      && form.languages.every((language) => String(form.referenceSolutions?.[language] ?? "").trim())
      ? referenceAnswerSignature(form)
      : "";
    generatedAnswerSignatureRef.current = existingSignature;
    setGeneratedAnswerSignature(existingSignature);
    activeAnswerRequestSignature.current = "";
    draftBaselines.current.set(draftKey, JSON.stringify(currentQuestionForm.current));
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
    if (draftBaselines.current.get(draftKey) === JSON.stringify(questionForm)) return undefined;
    if (!hasMeaningfulCodingDraft(questionForm)) {
      localStorage.removeItem(draftKey);
      setDraftSavedAt("");
      setDraftStatus("idle");
      return undefined;
    }
    setDraftStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        const serialized = serializeCodingDraft(questionForm);
        localStorage.setItem(draftKey, serialized);
        const parsed = parseCodingDraft(serialized);
        setDraftSavedAt(parsed.savedAt);
        setDraftStatus("saved");
      } catch {
        setDraftStatus("failed");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draftKey, isCoding, questionForm]);

  const restoreDraft = () => {
    setQuestionForm(questionToForm(draftOffer.form));
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
  const submitQuestion = async (event) => {
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
    const wasEditing = Boolean(editingQuestionId);
    const saved = await createQuestion(event);
    if (saved) {
      localStorage.removeItem(draftKey);
      blockedDraftKeys.current.delete(draftKey);
      setDraftStatus("idle");
      generatedAnswerSignatureRef.current = "";
      setGeneratedAnswerSignature("");
      setAiAuthoringComplete(false);
      activeAnswerRequestSignature.current = "";
      if (wasEditing) setIsAuthoringOpen(false);
    }
    return saved;
  };
  const errorFor = (field) => visibleErrors[field] ? <span className="coding-field-error" id={`coding-error-${field}`} role="alert">{visibleErrors[field]}</span> : null;
  const requiredLabel = (label, field) => <span className="coding-field-label"><span>{label}</span>{visibleErrors[field] && <span className="required-mark">필수</span>}</span>;
  const tabStatus = (tab) => {
    if (tab.fields.some((field) => visibleErrors[field])) return "확인 필요";
    if (!tab.fields.some((field) => allErrors[field])) return "완료";
    return "작성 중";
  };
  const retryReferenceAnswer = async () => {
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

  return <section id="question-management" className="data-panel form-panel coding-problem-form detail-management-panel">
    <div className="panel-heading"><div><h2>문제 정보 편집</h2><p>직접 작성하거나 출제 도우미로 초안을 빠르게 채울 수 있습니다.</p></div><div className="question-panel-actions"><button className="secondary-button compact-button" type="button" onClick={openPreview}><Eye size={16} /> 등록된 시험지 전체 미리보기</button><BookOpen size={20} /></div></div>
    {draftOffer && isCoding && <div className="coding-draft-offer" role="status"><div><strong>저장된 초안이 있습니다.</strong><span>{new Date(draftOffer.savedAt).toLocaleString("ko-KR")} 저장{draftOffer.omittedFileCount ? ` · 첨부 파일 ${draftOffer.omittedFileCount}개는 다시 첨부해야 합니다.` : ""}</span></div><div><button className="secondary-button compact-button" type="button" onClick={discardDraft}>버리기</button><button className="primary-button compact-button" type="button" onClick={restoreDraft}>복구</button></div></div>}
    {isAuthoringOpen ? <form onSubmit={submitQuestion} noValidate={isCoding}>
      <div className="coding-authoring-layout">
        <main className="coding-editor-column">
          <nav className="coding-editor-tabs" aria-label="문제 정보 편집 영역">
            {CODING_EDITOR_TABS.map((tab) => { const status = tabStatus(tab); return <button key={tab.id} id={`coding-editor-tab-${tab.id}`} type="button" role="tab" aria-selected={editorTab === tab.id} className={editorTab === tab.id ? "active" : ""} onClick={() => setEditorTab(tab.id)}><strong>{tab.label}</strong><em className={status === "확인 필요" ? "attention" : status === "완료" ? "complete" : "incomplete"}>{status}</em></button>; })}
          </nav>
          <div className="coding-step-panel coding-editor-panel" role="tabpanel" aria-labelledby={`coding-editor-tab-${editorTab}`}>
            {editorTab === "problem" && <><section className="coding-editor-section"><h4>제목 및 언어</h4><label>{requiredLabel("문제 제목", "title")}<input id="coding-field-title" value={questionForm.title} aria-invalid={Boolean(visibleErrors.title)} aria-describedby={visibleErrors.title ? "coding-error-title" : undefined} onChange={(event) => updateForm("title", event.target.value)} placeholder="예: 두 수의 합" />{errorFor("title")}</label><fieldset className="coding-language-field" id="coding-field-languages" tabIndex="-1"><legend>{requiredLabel("사용 언어", "languages")}</legend><div className="language-options">{["Python", "Java", "C", "JavaScript"].map((language) => <label key={language}><input type="checkbox" checked={questionForm.languages.includes(language)} onChange={() => toggleCodingLanguage(language)} /> {language}</label>)}</div>{errorFor("languages")}</fieldset></section><section className="coding-editor-section"><h4>문제 본문</h4>{[["description", "문제 설명"], ["inputFormat", "입력 형식"], ["outputFormat", "출력 형식"], ["constraints", "제한"]].map(([field, label]) => <label key={field}>{requiredLabel(label, field)}<textarea id={`coding-field-${field}`} value={questionForm[field]} aria-invalid={Boolean(visibleErrors[field])} aria-describedby={visibleErrors[field] ? `coding-error-${field}` : undefined} onChange={(event) => updateForm(field, event.target.value)} />{errorFor(field)}</label>)}</section></>}
            {editorTab === "tests" && <><TestCaseEditor collection="publicExamples" cases={questionForm.publicExamples} addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateCodingTestCase} error={visibleErrors.publicExamples} /><TestCaseEditor collection="hiddenTestCases" cases={questionForm.hiddenTestCases} addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateCodingTestCase} error={visibleErrors.hiddenTestCases} /><details className="coding-advanced-settings" open={questionForm.judgeMode !== "EXACT"}><summary>채점 방식 설정 <span>{questionForm.judgeMode === "EXACT" ? "기본값 사용 중" : "고급 설정 사용 중"}</span></summary><div><label>비교 방식<select value={questionForm.judgeMode} onChange={(event) => updateForm("judgeMode", event.target.value)}><option value="EXACT">정확히 일치</option><option value="IGNORE_WHITESPACE">공백·줄바꿈 무시</option><option value="NUMERIC_TOLERANCE">숫자 오차 허용</option><option value="CUSTOM">별도 채점 코드</option></select></label>{questionForm.judgeMode === "NUMERIC_TOLERANCE" && <label>허용 오차<input id="coding-field-numericTolerance" type="number" min="0" step="any" value={questionForm.numericTolerance} onChange={(event) => updateForm("numericTolerance", event.target.value)} />{errorFor("numericTolerance")}</label>}{questionForm.judgeMode === "CUSTOM" && <label>별도 채점 코드<textarea id="coding-field-customJudgeCode" className="code-editor" value={questionForm.customJudgeCode} onChange={(event) => updateForm("customJudgeCode", event.target.value)} />{errorFor("customJudgeCode")}</label>}</div></details></>}
          </div>
        </main>
        <aside className="coding-ai-workspace" aria-label="출제 도우미">
          <header><span>AUTHORING ASSISTANT</span><h3>출제 도우미</h3><p>조건만 정하면 시안 작성부터 답안 준비까지 이어집니다.</p></header>
          {!editingQuestionId && <ProblemCreationChatbot codingOnly examId={examId} completed={aiAuthoringComplete} onApplyCoding={(form) => { setQuestionType("CODING"); setQuestionForm((current) => ({ ...current, ...form, aiAnalysis: { ...current.aiAnalysis, ...form.aiAnalysis, authoringSource: "AI_ASSISTANT" } })); setAiAuthoringComplete(true); setEditorTab("problem"); setAiDraftApplyNonce((current) => current + 1); }} />}
          {editingQuestionId && <div className="coding-ai-edit-note">수정한 내용이 저장되면 최신 기준으로 답안을 다시 준비합니다.</div>}
          <AiReferenceAnswerEditor questionForm={questionForm} requestAiReferenceAnswer={retryReferenceAnswer} answerOutdated={answerOutdated} />
        </aside>
      </div>
      <div className="coding-form-actions coding-sticky-actions">{message && <div className={`coding-action-message ${messageType === "error" ? "error" : ""}`} role={messageType === "error" ? "alert" : "status"}>{message}</div>}<div className="coding-action-row"><div className="coding-bottom-statuses"><span className={`coding-draft-status ${draftStatus}`}>{draftStatus === "saving" ? "초안 저장 중…" : draftStatus === "saved" && draftSavedAt ? `${new Date(draftSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 초안 저장됨` : draftStatus === "failed" ? "초안 저장 실패" : "브라우저에 자동 저장"}</span><span className={`coding-answer-status ${referenceAnswerReady ? "ready" : answerState.status.toLowerCase()}`}>{answerState.status === "PROCESSING" ? "답안 준비 중" : referenceAnswerReady ? "답안 준비 완료" : answerOutdated ? "답안 다시 생성 필요" : answerState.status === "FAILED" || answerState.status === "BLOCKED" ? "답안 확인 필요" : "답안 준비 대기"}</span></div><div><button className="primary-button" type="submit" disabled={!hasValidationErrors && (!referenceAnswerReady || answerState.status === "PROCESSING")}><Save size={16} /> {editingQuestionId ? "수정 사항 저장" : "시험 문제 등록"}</button></div></div></div>
    </form> : <div className="coding-new-question-prompt"><div><strong>수정 사항을 저장했습니다.</strong><p>다른 문제를 추가하려면 새 문제 등록을 시작해 주세요.</p></div><button className="primary-button" type="button" onClick={() => setIsAuthoringOpen(true)}><Plus size={16} /> 새 문제 등록</button></div>}
    <div className="question-list"><div className="section-title-row"><h3>출제된 문제</h3><span className="text-muted">{questions.length}개</span></div>{questions.map((question, index) => <article className={`question-list-row ${editingQuestionId === question.id ? "selected" : ""}`} key={question.id}><div><strong>{index + 1}. {question.type === "CODING" ? question.title : question.prompt}</strong><span>{question.type === "CODING" ? `코딩 · 비공개 채점 케이스 ${question.hiddenTestCases?.length ?? 0}개` : `객관식 · 선택지 ${question.options?.length ?? 0}개`}</span></div><div className="question-row-actions">{question.type === "CODING" && <button className="secondary-button compact-button" type="button" onClick={() => editQuestion(question)}><Pencil size={14} /> 수정</button>}<button className="danger-button compact-button" type="button" onClick={() => setQuestionToDelete(question)}><Trash2 size={14} /> 삭제</button></div></article>)}{!questions.length && <p className="empty-state">아직 등록된 문제가 없습니다.</p>}</div>
  </section>;
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
        <p className="form-hint">편집 폼을 수정한 경우 답안을 다시 생성해 주세요.</p>
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
    {answerState.status === "FAILED" && <div className="ai-reference-feasibility-warning" role="alert"><strong>모범 답안 생성에 실패했습니다.</strong><p>{answerState.errorMessage || "서버에서 실패 사유를 받지 못했습니다. 관리자 AI API 키와 모델 설정, 백엔드 로그를 확인해주세요."}</p></div>}
    {answerState.status === "GENERATED" && answerState.warnings.length > 0 && <div className="ai-reference-feasibility-warning caution"><strong>생성 전제 확인</strong><ul>{answerState.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    {answerState.provider && <p className="form-hint">관리자 중앙 AI 설정: {answerState.provider} · {answerState.model}</p>}
    {hasGeneratedAnswer ? <div className="ai-generated-answer-list">
      {languages.map((language) => {
        const source = String(questionForm.referenceSolutions?.[language] ?? "").trim();
        return source ? <details className="ai-generated-answer" key={language}>
          <summary><strong>{language}</strong><span className="ai-language-success"><Check size={14} /> 생성 완료</span></summary>
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
