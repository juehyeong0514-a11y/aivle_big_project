import React, { useEffect, useMemo, useRef, useState } from "react";
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
  CODING_STEPS,
  codingDraftKey,
  getCodingStepStates,
  parseCodingDraft,
  serializeCodingDraft,
  stepForError,
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
const isHttpUrl = (value) => /^https?:\/\//i.test(String(value ?? "").trim());
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

const aiRubricOptions = [
  ["CORRECTNESS", "정답성"],
  ["EDGE_CASE", "경계값 처리"],
  ["TIME_COMPLEXITY", "시간복잡도"],
  ["SPACE_COMPLEXITY", "공간복잡도"],
  ["READABILITY", "코드 가독성"],
  ["ERROR_HANDLING", "예외 처리"],
  ["MODULARITY", "함수 분리"],
];
const aiMistakeOptions = [
  ["EMPTY_INPUT", "빈 입력 처리 누락"],
  ["DUPLICATE_VALUE", "중복값 처리 누락"],
  ["NEGATIVE_VALUE", "음수 처리 누락"],
  ["TIMEOUT", "시간복잡도 초과"],
  ["TYPE_ERROR", "자료형 오류"],
  ["OFF_BY_ONE", "인덱스 범위 오류"],
];
const aiAlgorithmOptions = [
  ["ARRAY_TRAVERSAL", "배열 순회"],
  ["SORTING", "정렬"],
  ["HASH_MAP", "해시맵"],
  ["TWO_POINTERS", "투 포인터"],
  ["DYNAMIC_PROGRAMMING", "동적 계획법"],
  ["BFS_DFS", "BFS·DFS"],
];
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
  const [activeQuestionStep, setActiveQuestionStep] = useState(0);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [candidateForm, setCandidateForm] = useState({ name: "", email: "", birthDate: "" });
  const [candidateSearch, setCandidateSearch] = useState("");
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [candidateUploadError, setCandidateUploadError] = useState("");
  const [candidateUploadPreview, setCandidateUploadPreview] = useState([]);
  const [candidateUploadFileName, setCandidateUploadFileName] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [selectedAdminCandidateIds, setSelectedAdminCandidateIds] = useState([]);
  const [candidateAdminSearch, setCandidateAdminSearch] = useState("");
  const [mailPreviews, setMailPreviews] = useState([]);
  const [copiedEntryLink, setCopiedEntryLink] = useState("");
  const [activeManagementPanel, setActiveManagementPanel] = useState("questions");
  const [isExamPreviewOpen, setIsExamPreviewOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [questionToDelete, setQuestionToDelete] = useState(null);
  const [messageType, setMessageType] = useState("info");
  const headers = { headers: authHeaders() };
  const uploadableCandidateCount = candidateUploadPreview.filter((candidate) => !candidate.uploadError).length;
  const uploadErrorCount = candidateUploadPreview.length - uploadableCandidateCount;

  const load = async () => {
    const [examResponse, candidateResponse, examCandidateResponse, questionResponse, invitationResponse] =
      await Promise.all([
        api.get("/manager/exams", headers),
        api.get("/manager/candidates", headers),
        api.get(`/manager/exams/${examId}/candidates`, headers),
        api.get(`/manager/exams/${examId}/questions`, headers),
        api.get("/manager/invitations", headers),
      ]);
    setExam(examResponse.data.find((item) => item.id === examId) || null);
    setCandidates(examCandidateResponse.data);
    setOrganizationCandidates(candidateResponse.data);
    setQuestions(questionResponse.data);
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
    setSelectedAdminCandidateIds((current) =>
      current.filter((candidateId) =>
        examCandidateResponse.data.some(
          (candidate) => candidate.id === candidateId,
        ),
      ),
    );
  };

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  useEffect(() => {
    load().catch((reason) =>
      setError(
        apiErrorMessage(reason, "시험 상세 정보를 불러오지 못했습니다."),
      ),
    );
  }, [examId]);

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
  const visibleAdminCandidates = useMemo(
    () =>
      scopedCandidates.filter((candidate) =>
          `${candidate.name} ${candidate.email}`.toLowerCase().includes(candidateAdminSearch.trim().toLowerCase()),
        ),
    [scopedCandidates, candidateAdminSearch],
  );
  const allAdminCandidatesSelected =
    visibleAdminCandidates.length > 0 &&
    visibleAdminCandidates.every((candidate) =>
      selectedAdminCandidateIds.includes(candidate.id),
    );

  const requestAiReferenceAnswer = async () => {
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
        question: { ...questionForm, type: "CODING", numericTolerance: Number(questionForm.numericTolerance) },
      }, headers);
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
        return;
      }
      setQuestionForm((current) => ({
        ...current,
        referenceSolutions: { ...current.referenceSolutions, ...(data.answers ?? {}) },
        aiAnalysis: {
          ...current.aiAnalysis,
          referenceAnswer: { ...current.aiAnalysis.referenceAnswer, status: "GENERATED", generatedAt: data.generatedAt ?? "", feasibilityMessage: "", errorMessage: "", warnings: data.warnings ?? [], provider: data.provider ?? "", model: data.model ?? "" },
        },
      }));
      showMessage("6단계까지 입력한 내용을 바탕으로 AI 모범 답안을 생성했습니다.");
    } catch (reason) {
      const errorMessage = apiErrorMessage(reason, reason?.message || "AI 모범 답안 생성에 실패했습니다.");
      setQuestionForm((current) => ({
        ...current,
        aiAnalysis: {
          ...current.aiAnalysis,
          referenceAnswer: { ...current.aiAnalysis.referenceAnswer, status: "FAILED", errorMessage },
        },
      }));
      showMessage(errorMessage, "error");
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
      setActiveQuestionStep(0);
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
    setActiveQuestionStep(0);
    showMessage(`“${question.title}” 문제를 수정 중입니다.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelQuestionEdit = () => {
    setQuestionForm(initialCodingProblem());
    setMultipleChoiceForm(initialMultipleChoiceQuestion());
    setQuestionType("CODING");
    setEditingQuestionId("");
    setActiveQuestionStep(0);
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
      const existingCandidate = organizationCandidates.find(
        (candidate) => candidate.organizationId === exam.organizationId && candidate.email === normalizedEmail,
      );
      if (existingCandidate && candidates.some((candidate) => candidate.id === existingCandidate.id)) {
        showMessage("이 응시자는 현재 시험에 이미 등록되어 있습니다.", "error");
        return;
      }
      const candidateId = existingCandidate
        ? existingCandidate.id
        : (await api.post(
          "/manager/candidates",
          { ...candidateForm, organizationId: exam.organizationId },
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
      const organizationCandidatesByEmail = new Map(
        organizationCandidates
          .filter((candidate) => candidate.organizationId === exam.organizationId)
          .map((candidate) => [candidate.email.toLowerCase(), candidate]),
      );
      const uploadedEmails = new Set();
      const previewCandidates = parsedCandidates.map((candidate) => {
        const email = candidate.email.toLowerCase();
        const existingCandidate = organizationCandidatesByEmail.get(email);
        const uploadError = assignedEmails.has(email)
          ? "현재 시험에 이미 등록된 이메일입니다."
          : uploadedEmails.has(email)
            ? "파일 안에 중복된 이메일입니다."
            : "";
        uploadedEmails.add(email);
        return { ...candidate, existingCandidateId: existingCandidate?.id ?? "", uploadError };
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
      const existingCandidateIds = uploadableCandidates
        .filter((candidate) => candidate.existingCandidateId)
        .map((candidate) => candidate.existingCandidateId);
      const newCandidates = uploadableCandidates.filter((candidate) => !candidate.existingCandidateId);
      const createdCandidates = newCandidates.length
        ? (await api.post(
          "/manager/candidates/bulk",
          { organizationId: exam.organizationId, candidates: newCandidates },
          headers,
        )).data
        : [];
      await api.post(
        `/manager/exams/${examId}/assign`,
        { candidateIds: [...existingCandidateIds, ...createdCandidates.map((candidate) => candidate.id)] },
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
      setSelectedAdminCandidateIds((current) => current.filter((id) => id !== candidateId));
      setSelectedCandidateIds((current) => current.filter((id) => id !== candidateId));
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "응시자를 이 시험에서 제거하지 못했습니다."), "error");
    }
  };

  const deleteSelectedCandidates = async () => {
    if (selectedAdminCandidateIds.length === 0) return;
    if (!window.confirm(`${selectedAdminCandidateIds.length}명의 응시자를 이 시험에서 제거하시겠습니까? 조직 응시자 정보는 유지됩니다.`)) return;

    const candidateIdsToDelete = [...selectedAdminCandidateIds];
    try {
      await api.delete(`/manager/exams/${examId}/assignments`, {
        ...headers,
        data: { candidateIds: candidateIdsToDelete },
      });
      showMessage(`${candidateIdsToDelete.length}명의 응시자를 이 시험에서 제거했습니다.`);
      setSelectedAdminCandidateIds([]);
      setSelectedCandidateIds((current) => current.filter((id) => !candidateIdsToDelete.includes(id)));
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "응시자를 이 시험에서 제거하지 못했습니다."), "error");
    }
  };

  const toggleAdminCandidate = (id) =>
    setSelectedAdminCandidateIds((current) =>
      current.includes(id)
        ? current.filter((candidateId) => candidateId !== id)
        : [...current, id],
    );

  const toggleAllAdminCandidates = () => {
    if (allAdminCandidatesSelected) {
      setSelectedAdminCandidateIds([]);
    } else {
      setSelectedAdminCandidateIds(
        visibleAdminCandidates.map((candidate) => candidate.id),
      );
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
      <div className="workspace-heading no-bottom-margin">
        <div>
          <span className="workspace-eyebrow">EXAM DETAIL</span>
          <div className="title-with-badge">
            <h1>{exam.title}</h1>
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
          onClick={() => setActiveManagementPanel("questions")}
        >
          문제 및 미리보기
          <span className="exam-detail-tab-count">문제 {questions.length}개</span>
        </button>
        <button
          className={`exam-detail-tab ${activeManagementPanel === "candidates" ? "active" : ""}`}
          type="button"
          aria-pressed={activeManagementPanel === "candidates"}
          onClick={() => setActiveManagementPanel("candidates")}
        >
          응시자 관리
          <span className="exam-detail-tab-count">
            응시자 {examCandidateScope.count}명
          </span>
        </button>
        <button
          className={`exam-detail-tab ${activeManagementPanel === "invitations" ? "active" : ""}`}
          type="button"
          aria-pressed={activeManagementPanel === "invitations"}
          onClick={() => setActiveManagementPanel("invitations")}
        >
          배정 및 초대
          <span className="exam-detail-tab-count">
            {scopedCandidates.length}/{invitedCandidateIds.length}명
          </span>
        </button>
      </nav>

      {activeManagementPanel === "questions" && <QuestionManagement
        examId={examId}
        message={message} messageType={messageType}
        questionType={questionType} setQuestionType={setQuestionType} questionForm={questionForm} setQuestionForm={setQuestionForm}
        multipleChoiceForm={multipleChoiceForm} setMultipleChoiceForm={setMultipleChoiceForm} editingQuestionId={editingQuestionId}
        activeQuestionStep={activeQuestionStep} setActiveQuestionStep={setActiveQuestionStep} createQuestion={createQuestion}
        addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateTestCase} toggleLanguage={toggleLanguage}
        cancelQuestionEdit={cancelQuestionEdit} questions={questions} editQuestion={editQuestion} setQuestionToDelete={setQuestionToDelete}
        openPreview={() => setIsExamPreviewOpen(true)} requestAiReferenceAnswer={requestAiReferenceAnswer} />}

      {activeManagementPanel === "candidates" && (
        <form
          id="candidate-management"
          className="data-panel form-panel"
          onSubmit={createCandidate}
        >
          <div className="panel-heading">
            <div>
              <h2>응시자 이메일 등록</h2>
              <p>응시자를 추가하면 이 시험에만 등록됩니다.</p>
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
          <div className="workspace-subsection">
            <div className="panel-heading">
              <div>
                <h2>이 시험에 등록된 응시자 목록</h2>
                <p>이 시험에 추가한 응시자만 표시됩니다. 조직의 다른 시험 응시자는 이 목록에 나오지 않습니다.</p>
              </div>
            </div>
            <div className="candidate-controls-group">
              <div className="candidate-toolbar">
                <label className="select-all-control">
                  <input type="checkbox" checked={allAdminCandidatesSelected} onChange={toggleAllAdminCandidates} disabled={!visibleAdminCandidates.length} />
                  <span>전체 선택</span>
                </label>
              </div>
              <label className="input-with-icon">
                <Search size={16} />
                <input value={candidateAdminSearch} onChange={(event) => setCandidateAdminSearch(event.target.value)} placeholder="이름 또는 이메일 검색" />
              </label>
            </div>
            <div className="candidate-list-table">
              {visibleAdminCandidates.length > 0 ? (
                visibleAdminCandidates.map((candidate) => (
                  <div className="candidate-list-row" key={candidate.id}>
                    <input type="checkbox" checked={selectedAdminCandidateIds.includes(candidate.id)} onChange={() => toggleAdminCandidate(candidate.id)} />
                    <span>{candidate.name}</span>
                    <span>{candidate.email}</span>
                    <span>{candidate.birthDate ?? "미등록"}</span>
                    <div className="candidate-row-actions">
                      <button className="danger-button compact-button" type="button" onClick={() => setCandidateToDelete(candidate)}>
                        <Trash2 size={14} /> 삭제
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">등록된 응시자가 없습니다. 상단 폼을 통해 응시자를 등록해 주세요.</p>
              )}
            </div>
            {candidateToDelete && (
              <div className="workspace-alert error">
                <strong>{candidateToDelete.name}</strong> 응시자를 이 시험에서 제거하시겠습니까? 조직 응시자 정보는 유지됩니다.
                <div className="candidate-row-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="secondary-button compact-button" type="button" onClick={() => setCandidateToDelete(null)}>취소</button>
                  <button className="danger-button compact-button" type="button" onClick={() => deleteCandidate(candidateToDelete.id)}>시험에서 제거</button>
                </div>
              </div>
            )}
            <div className="floating-action-bar static">
              <div className="floating-action-bar-content">
                <span>{selectedAdminCandidateIds.length}명 선택됨</span>
                <div className="floating-action-buttons">
                  {selectedAdminCandidateIds.length > 0 && (
                    <button className="danger-button" type="button" onClick={deleteSelectedCandidates}>
                      <Trash2 size={16} /> 시험에서 제거 ({selectedAdminCandidateIds.length}명)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {activeManagementPanel === "invitations" && (
      <div id="invitation-management" className="data-panel">
        <div className="panel-heading">
          <div>
            <h2>시험 대상자 배정 및 초대</h2>
            <p>이 시험에 등록된 응시자에게 초대 링크를 보내거나, 선택한 대상자의 시험 배정을 해제할 수 있습니다.</p>
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
              <button className="secondary-button compact-button" type="button" onClick={(event) => { event.preventDefault(); setEditingCandidate({ ...candidate }); }}>
                <Pencil size={14} /> 수정
              </button>
            </label>
          ))}
          {!visibleCandidates.length && (
            <p className="empty-state">검색 결과가 없습니다.</p>
          )}
        </div>
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
              응시자에게 표시되는 문제 내용과 공개 예제만 미리봅니다. 숨김 테스트와 모범 답안은 표시되지 않습니다.
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

function QuestionManagement({ examId, message, messageType, questionType, setQuestionType, questionForm, setQuestionForm, multipleChoiceForm, setMultipleChoiceForm, editingQuestionId, activeQuestionStep, setActiveQuestionStep, createQuestion, addTestCase, removeTestCase, updateTestCase, toggleLanguage, cancelQuestionEdit, questions, editQuestion, setQuestionToDelete, openPreview, requestAiReferenceAnswer }) {
  const isCoding = questionType === "CODING";
  const updateOption = (index, value) => setMultipleChoiceForm((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? value : option) }));
  const addOption = () => setMultipleChoiceForm((current) => ({ ...current, options: [...current.options, ""] }));
  const removeOption = (index) => setMultipleChoiceForm((current) => ({ ...current, options: current.options.filter((_, optionIndex) => optionIndex !== index), answer: current.answer === current.options[index] ? "" : current.answer }));
  const updateForm = (field, value) => {
    setQuestionForm((current) => ({ ...current, [field]: value }));
    setVisibleErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const updateAiAnalysis = (field, value) => setQuestionForm((current) => ({ ...current, aiAnalysis: { ...current.aiAnalysis, [field]: value } }));
  const toggleAiCustomEnabled = (enabledField, enabled) => setQuestionForm((current) => ({
    ...current,
    aiAnalysis: {
      ...current.aiAnalysis,
      [enabledField]: enabled,
    },
  }));
  const addAiCustomTextItem = (field, draftField, enabledField) => setQuestionForm((current) => {
    const value = current.aiAnalysis[draftField].trim();
    if (!value) return current;
    return {
      ...current,
      aiAnalysis: {
        ...current.aiAnalysis,
        [field]: [...(current.aiAnalysis[field] ?? []), value],
        [enabledField]: false,
        [draftField]: "",
      },
    };
  });
  const updateAiCustomDraft = (field, value) => updateAiAnalysis(field, value);
  const removeAiCustomTextItem = (field, index) => updateAiAnalysis(field, (questionForm.aiAnalysis[field] ?? []).filter((_, itemIndex) => itemIndex !== index));
  const setCustomAlgorithmsEnabled = (enabled) => setQuestionForm((current) => ({
    ...current,
    aiAnalysis: {
      ...current.aiAnalysis,
      customAlgorithmsEnabled: enabled,
      customAlgorithmDraft: "",
    },
  }));
  const addCustomAlgorithm = () => setQuestionForm((current) => {
    const name = current.aiAnalysis.customAlgorithmDraft.trim();
    if (!name) return current;
    return {
      ...current,
      aiAnalysis: {
        ...current.aiAnalysis,
        customAlgorithms: [...(current.aiAnalysis.customAlgorithms ?? []), { name, level: "RECOMMENDED" }],
        customAlgorithmsEnabled: false,
        customAlgorithmDraft: "",
      },
    };
  });
  const updateCustomAlgorithm = (index, field, value) => updateAiAnalysis("customAlgorithms", (questionForm.aiAnalysis.customAlgorithms ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const removeCustomAlgorithm = (index) => updateAiAnalysis("customAlgorithms", (questionForm.aiAnalysis.customAlgorithms ?? []).filter((_, itemIndex) => itemIndex !== index));
  const toggleAiAnalysisValue = (field, value) => setQuestionForm((current) => ({
    ...current,
    aiAnalysis: {
      ...current.aiAnalysis,
      [field]: current.aiAnalysis[field].includes(value)
        ? current.aiAnalysis[field].filter((item) => item !== value)
        : [...current.aiAnalysis[field], value],
    },
  }));
  const toggleAlgorithm = (algorithm) => setQuestionForm((current) => {
    const requirements = current.aiAnalysis.algorithmRequirements ?? [];
    const isSelected = requirements.some((item) => item.algorithm === algorithm);
    return {
      ...current,
      aiAnalysis: {
        ...current.aiAnalysis,
        algorithmRequirements: isSelected
          ? requirements.filter((item) => item.algorithm !== algorithm)
          : [...requirements, { algorithm, level: "RECOMMENDED" }],
      },
    };
  });
  const updateAlgorithmLevel = (algorithm, level) => setQuestionForm((current) => ({
    ...current,
    aiAnalysis: {
      ...current.aiAnalysis,
      algorithmRequirements: (current.aiAnalysis.algorithmRequirements ?? []).map((item) => item.algorithm === algorithm ? { ...item, level } : item),
    },
  }));
  const updateLearningMaterial = (index, field, value) => updateAiAnalysis("learningMaterials", questionForm.aiAnalysis.learningMaterials.map((material, materialIndex) => materialIndex === index ? { ...material, [field]: value } : material));
  const addLearningMaterial = () => setQuestionForm((current) => {
    const materials = current.aiAnalysis.learningMaterials ?? [];
    const lastMaterial = materials[materials.length - 1];
    if (lastMaterial && !String(lastMaterial.title ?? "").trim() && !String(lastMaterial.url ?? "").trim()) return current;
    return {
      ...current,
      aiAnalysis: {
        ...current.aiAnalysis,
        learningMaterials: [...materials, { title: "", url: "" }],
      },
    };
  });
  const removeLearningMaterial = (index) => updateAiAnalysis("learningMaterials", questionForm.aiAnalysis.learningMaterials.filter((_, materialIndex) => materialIndex !== index));
  const uploadReferenceMaterial = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(txt|md|markdown|json|csv)$/i.test(file.name)) {
      window.alert("텍스트, Markdown, JSON, CSV 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > 250_000) {
      window.alert("첨부 파일은 250KB 이하로 올려주세요.");
      return;
    }
    updateAiAnalysis("referenceMaterials", [
      ...questionForm.aiAnalysis.referenceMaterials,
      { name: file.name, mimeType: file.type || "text/plain", content: await file.text() },
    ]);
  };
  const removeReferenceMaterial = (index) => updateAiAnalysis("referenceMaterials", questionForm.aiAnalysis.referenceMaterials.filter((_, materialIndex) => materialIndex !== index));
  const [visibleErrors, setVisibleErrors] = useState({});
  const [draftOffer, setDraftOffer] = useState(null);
  const [draftStatus, setDraftStatus] = useState("idle");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [previewTab, setPreviewTab] = useState("applicant");
  const draftKey = codingDraftKey(examId, editingQuestionId);
  const blockedDraftKeys = useRef(new Set());
  const draftBaselines = useRef(new Map());
  const currentQuestionForm = useRef(questionForm);
  currentQuestionForm.current = questionForm;
  const stepStates = getCodingStepStates(questionForm);
  const allErrors = validateCodingProblem(questionForm);

  useEffect(() => {
    setVisibleErrors({});
    setDraftOffer(null);
    draftBaselines.current.set(draftKey, JSON.stringify(currentQuestionForm.current));
    const parsed = parseCodingDraft(localStorage.getItem(draftKey));
    if (parsed) {
      blockedDraftKeys.current.add(draftKey);
      setDraftOffer(parsed);
      setDraftSavedAt(parsed.savedAt);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!isCoding || blockedDraftKeys.current.has(draftKey)) return undefined;
    if (draftBaselines.current.get(draftKey) === JSON.stringify(questionForm)) return undefined;
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
  const goToStep = (step) => {
    setActiveQuestionStep(step);
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
    setActiveQuestionStep(stepForError(field));
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
    const saved = await createQuestion(event);
    if (saved) {
      localStorage.removeItem(draftKey);
      blockedDraftKeys.current.delete(draftKey);
      setDraftStatus("idle");
    }
    return saved;
  };
  const errorFor = (field) => visibleErrors[field] ? <span className="coding-field-error" id={`coding-error-${field}`} role="alert">{visibleErrors[field]}</span> : null;
  const requiredLabel = (label) => <>{label} <span className="required-mark">필수</span></>;

  return <section id="question-management" className="data-panel form-panel coding-problem-form">
    <div className="panel-heading"><div><h2>문제 및 미리보기</h2><p>단계별 완료 상태와 응시자 화면을 한곳에서 확인하세요.</p></div><div className="question-panel-actions"><button className="secondary-button compact-button" type="button" onClick={openPreview}><Eye size={16} /> 등록된 시험지 전체 미리보기</button><BookOpen size={20} /></div></div>
    {!editingQuestionId && <ProblemCreationChatbot examId={examId} onApplyCoding={(form) => { setQuestionType("CODING"); setQuestionForm((current) => ({ ...current, ...form })); setActiveQuestionStep(0); }} onApplyMultipleChoice={(form) => { setQuestionType("MULTIPLE_CHOICE"); setMultipleChoiceForm(form); setActiveQuestionStep(0); }} />}
    <div className="question-type-switch" role="group" aria-label="문제 유형"><button type="button" disabled={Boolean(editingQuestionId)} className={isCoding ? "active" : ""} onClick={() => { setQuestionType("CODING"); setActiveQuestionStep(0); }}>코딩 문제</button><button type="button" disabled={Boolean(editingQuestionId)} className={!isCoding ? "active" : ""} onClick={() => { setQuestionType("MULTIPLE_CHOICE"); setActiveQuestionStep(0); }}>객관식 문제</button>{editingQuestionId && <span className="form-hint">수정 중에는 문제 유형을 변경할 수 없습니다.</span>}</div>
    {draftOffer && isCoding && <div className="coding-draft-offer" role="status"><div><strong>저장된 초안이 있습니다.</strong><span>{new Date(draftOffer.savedAt).toLocaleString("ko-KR")} 저장{draftOffer.omittedFileCount ? ` · 첨부 파일 ${draftOffer.omittedFileCount}개는 다시 첨부해야 합니다.` : ""}</span></div><div><button className="secondary-button compact-button" type="button" onClick={discardDraft}>버리기</button><button className="primary-button compact-button" type="button" onClick={restoreDraft}>복구</button></div></div>}
    <form onSubmit={submitQuestion} noValidate={isCoding}>
      {isCoding ? <>
        <div className="coding-authoring-layout">
          <div className="coding-workflow-header"><nav className="coding-step-navigation" aria-label="코딩 문제 작성 단계">{CODING_STEPS.map((step, index) => <button key={step.id} id={`coding-step-${index}`} type="button" aria-current={activeQuestionStep === index ? "step" : undefined} className={activeQuestionStep === index ? "active" : ""} onClick={() => goToStep(index)}><b>{index + 1}</b><span><strong>{step.title}</strong><small>{step.description}</small></span><em className={`coding-step-status ${stepStates[index]}`}>{({ complete: "완료", attention: "확인 필요", incomplete: "작성 중", optional: "선택" })[stepStates[index]]}</em></button>)}</nav></div>
          <main className="coding-editor-column">
            <header className="coding-step-heading"><div><span>STEP {activeQuestionStep + 1}</span><h3>{CODING_STEPS[activeQuestionStep].title}</h3><p>{CODING_STEPS[activeQuestionStep].description}</p></div>{CODING_STEPS[activeQuestionStep].optional && <em>선택 사항</em>}</header>
            <div className="coding-step-panel" role="region" aria-labelledby={`coding-step-${activeQuestionStep}`}>
              {activeQuestionStep === 0 && <><label>{requiredLabel("문제 제목")}<input id="coding-field-title" value={questionForm.title} aria-invalid={Boolean(visibleErrors.title)} aria-describedby={visibleErrors.title ? "coding-error-title" : undefined} onChange={(event) => updateForm("title", event.target.value)} placeholder="예: 두 수의 합" /></label>{errorFor("title")}<fieldset className="coding-language-field" id="coding-field-languages" tabIndex="-1"><legend>{requiredLabel("사용 언어")}</legend><div className="language-options">{["Python", "Java", "C", "JavaScript"].map((language) => <label key={language}><input type="checkbox" checked={questionForm.languages.includes(language)} onChange={() => toggleCodingLanguage(language)} /> {language}</label>)}</div>{errorFor("languages")}</fieldset></>}
              {activeQuestionStep === 1 && [["description", "문제 설명"], ["inputFormat", "입력 형식"], ["outputFormat", "출력 형식"], ["constraints", "제한"]].map(([field, label]) => <label key={field}>{requiredLabel(label)}<textarea id={`coding-field-${field}`} value={questionForm[field]} aria-invalid={Boolean(visibleErrors[field])} aria-describedby={visibleErrors[field] ? `coding-error-${field}` : undefined} onChange={(event) => updateForm(field, event.target.value)} />{errorFor(field)}</label>)}
              {activeQuestionStep === 2 && <><TestCaseEditor collection="publicExamples" cases={questionForm.publicExamples} addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateCodingTestCase} error={visibleErrors.publicExamples} /><TestCaseEditor collection="hiddenTestCases" cases={questionForm.hiddenTestCases} addTestCase={addTestCase} removeTestCase={removeTestCase} updateTestCase={updateCodingTestCase} error={visibleErrors.hiddenTestCases} /><details className="coding-advanced-settings" open={questionForm.judgeMode !== "EXACT"}><summary>채점 방식 설정 <span>{questionForm.judgeMode === "EXACT" ? "기본값 사용 중" : "고급 설정 사용 중"}</span></summary><div><label>비교 방식<select value={questionForm.judgeMode} onChange={(event) => updateForm("judgeMode", event.target.value)}><option value="EXACT">정확히 일치</option><option value="IGNORE_WHITESPACE">공백·줄바꿈 무시</option><option value="NUMERIC_TOLERANCE">숫자 오차 허용</option><option value="CUSTOM">별도 채점 코드</option></select></label>{questionForm.judgeMode === "NUMERIC_TOLERANCE" && <label>허용 오차<input id="coding-field-numericTolerance" type="number" min="0" step="any" value={questionForm.numericTolerance} onChange={(event) => updateForm("numericTolerance", event.target.value)} />{errorFor("numericTolerance")}</label>}{questionForm.judgeMode === "CUSTOM" && <label>별도 채점 코드<textarea id="coding-field-customJudgeCode" className="code-editor" value={questionForm.customJudgeCode} onChange={(event) => updateForm("customJudgeCode", event.target.value)} />{errorFor("customJudgeCode")}</label>}</div></details></>}
              {activeQuestionStep === 3 && <AiAnalysisEditor aiAnalysis={questionForm.aiAnalysis} updateAiAnalysis={updateAiAnalysis} toggleAiAnalysisValue={toggleAiAnalysisValue} toggleAiCustomEnabled={toggleAiCustomEnabled} addAiCustomTextItem={addAiCustomTextItem} updateAiCustomDraft={updateAiCustomDraft} removeAiCustomTextItem={removeAiCustomTextItem} setCustomAlgorithmsEnabled={setCustomAlgorithmsEnabled} addCustomAlgorithm={addCustomAlgorithm} updateCustomAlgorithm={updateCustomAlgorithm} removeCustomAlgorithm={removeCustomAlgorithm} toggleAlgorithm={toggleAlgorithm} updateAlgorithmLevel={updateAlgorithmLevel} updateLearningMaterial={updateLearningMaterial} addLearningMaterial={addLearningMaterial} removeLearningMaterial={removeLearningMaterial} uploadReferenceMaterial={uploadReferenceMaterial} removeReferenceMaterial={removeReferenceMaterial} />}
              {activeQuestionStep === 4 && <ReviewAndRegister questionForm={questionForm} errors={allErrors} focusError={focusError} requestAiReferenceAnswer={requestAiReferenceAnswer} />}
            </div>
          </main>
          <DraftPreview questionForm={questionForm} previewTab={previewTab} setPreviewTab={setPreviewTab} />
        </div>
      </> : <div className="multiple-choice-editor"><label>문제 문구<textarea value={multipleChoiceForm.prompt} onChange={(event) => setMultipleChoiceForm((current) => ({ ...current, prompt: event.target.value }))} required /></label><div className="section-title-row"><h3>선택지</h3><button className="secondary-button compact-button" type="button" onClick={addOption}>선택지 추가</button></div>{multipleChoiceForm.options.map((option, index) => <div className="multiple-choice-option" key={index}><label>선택지 {index + 1}<input value={option} onChange={(event) => updateOption(index, event.target.value)} required /></label>{multipleChoiceForm.options.length > 2 && <button className="text-button" type="button" onClick={() => removeOption(index)}>삭제</button>}</div>)}<label>정답<select value={multipleChoiceForm.answer} onChange={(event) => setMultipleChoiceForm((current) => ({ ...current, answer: event.target.value }))} required><option value="">정답 선택</option>{multipleChoiceForm.options.filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div>}
      <div className="coding-form-actions coding-sticky-actions">{message && <div className={`coding-action-message ${messageType === "error" ? "error" : ""}`} role={messageType === "error" ? "alert" : "status"}>{message}</div>}<div className="coding-action-row"><span>{isCoding && <span className={`coding-draft-status ${draftStatus}`}>{draftStatus === "saving" ? "초안 저장 중…" : draftStatus === "saved" && draftSavedAt ? `${new Date(draftSavedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 초안 저장됨` : draftStatus === "failed" ? "초안 저장 실패" : "브라우저에 자동 저장"}</span>}</span><div>{isCoding && <button className="secondary-button" type="button" disabled={activeQuestionStep === 0} onClick={() => goToStep(activeQuestionStep - 1)}>이전</button>}{isCoding && activeQuestionStep < CODING_STEPS.length - 1 && <button className="secondary-button" type="button" onClick={() => goToStep(activeQuestionStep + 1)}>다음</button>}<button className="primary-button" type="submit"><Save size={16} /> {editingQuestionId ? "수정 사항 저장" : "문제 등록"}</button>{editingQuestionId && <button className="secondary-button" type="button" onClick={cancelQuestionEdit}>새 문제 등록</button>}</div></div></div>
    </form>
    <div className="question-list"><div className="section-title-row"><h3>출제된 문제</h3><span className="text-muted">{questions.length}개</span></div>{questions.map((question, index) => <article className={`question-list-row ${editingQuestionId === question.id ? "selected" : ""}`} key={question.id}><div><strong>{index + 1}. {question.type === "CODING" ? question.title : question.prompt}</strong><span>{question.type === "CODING" ? `코딩 · 숨김 테스트 ${question.hiddenTestCases?.length ?? 0}개` : `객관식 · 선택지 ${question.options?.length ?? 0}개`}</span></div><div className="question-row-actions"><button className="secondary-button compact-button" type="button" onClick={() => editQuestion(question)}><Pencil size={14} /> 수정</button><button className="danger-button compact-button" type="button" onClick={() => setQuestionToDelete(question)}><Trash2 size={14} /> 삭제</button></div></article>)}{!questions.length && <p className="empty-state">아직 등록된 문제가 없습니다.</p>}</div>
  </section>;
}

function ReviewAndRegister({ questionForm, errors, focusError, requestAiReferenceAnswer }) {
  const errorEntries = Object.entries(errors);
  return <div className="coding-review">
    {errorEntries.length > 0 && <div className="coding-error-summary" role="alert"><h4>확인할 항목</h4>{errorEntries.map(([field, message]) => <button type="button" key={field} onClick={() => focusError(field)}>{message}<span>수정하기 →</span></button>)}</div>}
    <AiReferenceAnswerEditor questionForm={questionForm} requestAiReferenceAnswer={requestAiReferenceAnswer} />
  </div>;
}

const judgeModeLabel = (mode) => ({ EXACT: "정확히 일치", IGNORE_WHITESPACE: "공백·줄바꿈 무시", NUMERIC_TOLERANCE: "숫자 오차 허용", CUSTOM: "별도 채점 코드" })[mode] ?? mode;
const draftText = (value) => String(value ?? "").trim() || "아직 작성되지 않음";

function DraftPreview({ questionForm, previewTab, setPreviewTab }) {
  return <aside className="coding-draft-preview" aria-label="현재 초안 미리보기">
    <header><div><span>LIVE PREVIEW</span><h3>현재 초안</h3></div><Eye size={18} /></header>
    <div className="coding-preview-tabs" role="tablist"><button type="button" role="tab" aria-selected={previewTab === "applicant"} className={previewTab === "applicant" ? "active" : ""} onClick={() => setPreviewTab("applicant")}>응시자 화면</button><button type="button" role="tab" aria-selected={previewTab === "check"} className={previewTab === "check" ? "active" : ""} onClick={() => setPreviewTab("check")}>작성 점검</button></div>
    {previewTab === "applicant" ? <div className="coding-preview-content applicant"><div className="coding-preview-title"><small>코딩 문제</small><h4>{draftText(questionForm.title)}</h4><span>{questionForm.languages.length ? questionForm.languages.join(" · ") : "사용 언어 미선택"}</span></div><p>{draftText(questionForm.description)}</p><PreviewDetail title="입력 형식" content={draftText(questionForm.inputFormat)} /><PreviewDetail title="출력 형식" content={draftText(questionForm.outputFormat)} /><PreviewDetail title="제한" content={draftText(questionForm.constraints)} />{questionForm.publicExamples.map((example, index) => <section className="exam-preview-example" key={`draft-example-${index}`}><strong>예제 {index + 1}</strong><div><span>입력</span><pre>{draftText(example.input)}</pre></div><div><span>출력</span><pre>{draftText(example.expectedOutput)}</pre></div>{example.explanation && <p>{example.explanation}</p>}</section>)}</div> : <div className="coding-preview-content check"><dl><div><dt>필수 입력</dt><dd>{Object.keys(validateCodingProblem(questionForm)).length ? `${Object.keys(validateCodingProblem(questionForm)).length}개 확인 필요` : "완료"}</dd></div><div><dt>공개 예제</dt><dd>{questionForm.publicExamples.length}개</dd></div><div><dt>숨김 테스트</dt><dd>{questionForm.hiddenTestCases.length}개</dd></div><div><dt>채점 방식</dt><dd>{judgeModeLabel(questionForm.judgeMode)}</dd></div><div><dt>AI 분석</dt><dd>{questionForm.aiAnalysis.enabled ? "사용" : "사용 안 함"}</dd></div><div><dt>참고 파일</dt><dd>{questionForm.aiAnalysis.referenceMaterials.length}개</dd></div></dl><p>숨김 테스트, 모범 답안과 AI 분석 기준은 응시자에게 표시되지 않습니다.</p></div>}
  </aside>;
}

function AiReferenceAnswerEditor({ questionForm, requestAiReferenceAnswer }) {
  const answerState = questionForm.aiAnalysis.referenceAnswer ?? { status: "NOT_RUN", generatedAt: "" };
  const languages = questionForm.languages?.length ? questionForm.languages : [];
  const statusLabels = { NOT_RUN: "생성 전", PROCESSING: "생성 중", GENERATED: "생성 완료", BLOCKED: "조건 확인 필요", FAILED: "생성 실패" };
  const hasGeneratedAnswer = languages.some((language) => String(questionForm.referenceSolutions?.[language] ?? "").trim());
  return <section className="ai-reference-answer-section">
    <div className="section-title-row">
      <div>
        <h3>AI 생성 모범 답안</h3>
        <p className="form-hint">1~6단계에서 입력한 문제 설명, 예제, 숨김 테스트, 채점 설정, AI 분석 기준을 바탕으로 생성합니다.</p>
      </div>
      <span className={`ai-validation-status ${answerState.status.toLowerCase()}`}>{statusLabels[answerState.status] ?? "생성 전"}</span>
    </div>
    <div className="ai-reference-answer-actions">
      <button className="secondary-button" type="button" onClick={requestAiReferenceAnswer} disabled={!questionForm.aiAnalysis.enabled || answerState.status === "PROCESSING" || !questionForm.title.trim() || !questionForm.description.trim() || languages.length === 0}>
        <CheckSquare size={16} /> {answerState.status === "PROCESSING" ? "모범 답안 생성 중..." : hasGeneratedAnswer ? "모범 답안 다시 생성" : "모범 답안 생성"}
      </button>
      <span className="form-hint">언어를 선택하고 문제 제목과 설명을 입력하면 생성할 수 있습니다.</span>
    </div>
    {answerState.status === "BLOCKED" && <div className="ai-reference-feasibility-warning" role="alert"><strong>현재 조건으로 모범 답안을 생성할 수 없습니다.</strong><p>{answerState.feasibilityMessage}</p>{answerState.warnings.length > 0 && <ul>{answerState.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</div>}
    {answerState.status === "FAILED" && <div className="ai-reference-feasibility-warning" role="alert"><strong>모범 답안 생성에 실패했습니다.</strong><p>{answerState.errorMessage || "서버에서 실패 사유를 받지 못했습니다. 관리자 AI API 키와 모델 설정, 백엔드 로그를 확인해주세요."}</p></div>}
    {answerState.status === "GENERATED" && answerState.warnings.length > 0 && <div className="ai-reference-feasibility-warning caution"><strong>생성 전제 확인</strong><ul>{answerState.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    {answerState.provider && <p className="form-hint">관리자 중앙 AI 설정: {answerState.provider} · {answerState.model}</p>}
    {hasGeneratedAnswer ? <div className="ai-generated-answer-list">
      {languages.map((language) => {
        const source = String(questionForm.referenceSolutions?.[language] ?? "").trim();
        return source ? <article className="ai-generated-answer" key={language}>
          <div className="section-title-row"><strong>{language}</strong><span className="form-hint">AI가 생성한 모범 답안</span></div>
          <pre>{source}</pre>
        </article> : null;
      })}
    </div> : <p className="empty-state">아직 생성된 모범 답안이 없습니다.</p>}
    <p className="form-hint">생성된 답안은 출제자 검토와 AI 채점 참고용이며 응시자에게 공개되지 않습니다. 실제 점수는 숨김 테스트 결과를 기준으로 합니다.</p>
  </section>;
}

function ComplexityOptionGroup({ title, name, value, onChange, options, disabled }) {
  return <fieldset className="ai-option-group ai-complexity-group">
    <legend>{title} <span className="text-muted">(선택)</span></legend>
    <div className="ai-option-grid">
      {options.map(([optionValue, label]) => <label className="ai-option" key={`${name}-${optionValue || "none"}`}>
        <input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={() => onChange(optionValue)} disabled={disabled} />
        {label}
      </label>)}
    </div>
  </fieldset>;
}

function AiAnalysisEditor({ aiAnalysis, updateAiAnalysis, toggleAiAnalysisValue, toggleAiCustomEnabled, addAiCustomTextItem, updateAiCustomDraft, removeAiCustomTextItem, setCustomAlgorithmsEnabled, addCustomAlgorithm, updateCustomAlgorithm, removeCustomAlgorithm, toggleAlgorithm, updateAlgorithmLevel, updateLearningMaterial, addLearningMaterial, removeLearningMaterial, uploadReferenceMaterial, removeReferenceMaterial }) {
  const optionGroup = (title, field, options, customField, customEnabledField, draftField, customLabel, customPlaceholder) => {
    const selectedOptions = aiAnalysis[field] ?? [];
    const customItems = aiAnalysis[customField] ?? [];
    return <fieldset className="ai-option-group">
      <legend>{title}</legend>
      <div className="ai-option-grid">
        {options.map(([value, label]) => (
          <label key={value} className="ai-option">
            <input type="checkbox" checked={aiAnalysis[field].includes(value)} onChange={() => toggleAiAnalysisValue(field, value)} disabled={!aiAnalysis.enabled} />
            {label}
          </label>
        ))}
        <div className="ai-custom-algorithm-option ai-custom-text-option">
          <label className="ai-option ai-custom-algorithm-toggle">
            <input type="checkbox" checked={aiAnalysis[customEnabledField]} onChange={(event) => toggleAiCustomEnabled(customEnabledField, event.target.checked)} disabled={!aiAnalysis.enabled} />
            {customLabel}
          </label>
          {aiAnalysis[customEnabledField] && <div className="ai-custom-algorithm-draft">
            <input value={aiAnalysis[draftField]} onChange={(event) => updateAiCustomDraft(draftField, event.target.value)} disabled={!aiAnalysis.enabled} placeholder={customPlaceholder} aria-label={`${customLabel} 입력`} />
            <button className="secondary-button compact-button" type="button" onClick={() => addAiCustomTextItem(customField, draftField, customEnabledField)} disabled={!aiAnalysis.enabled || !aiAnalysis[draftField].trim()}>추가</button>
          </div>}
        </div>
      </div>
      {(selectedOptions.length > 0 || customItems.length > 0) && <div className="ai-selected-algorithms">
        <p className="form-hint">선택한 {title}</p>
        {selectedOptions.map((value) => {
          const label = options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
          return <div className="ai-algorithm-rule" key={value}>
            <span>{label}</span>
            <button className="ai-remove-button" type="button" onClick={() => toggleAiAnalysisValue(field, value)} disabled={!aiAnalysis.enabled} aria-label={`${label} 선택 해제`}><X size={14} /></button>
          </div>;
        })}
        {customItems.map((item, index) => <div className="ai-algorithm-rule" key={`${customField}-${index}`}>
          <span>{item}</span>
          <button className="ai-remove-button" type="button" onClick={() => removeAiCustomTextItem(customField, index)} disabled={!aiAnalysis.enabled} aria-label={`${item} 삭제`}><X size={14} /></button>
        </div>)}
      </div>}
    </fieldset>;
  };
  const selectedAlgorithms = aiAnalysis.algorithmRequirements ?? [];
  const customAlgorithms = aiAnalysis.customAlgorithms ?? [];
  const learningMaterials = aiAnalysis.learningMaterials ?? [{ title: "", url: "" }];
  const learningMaterialDraftIndex = learningMaterials.length - 1;
  const savedLearningMaterials = learningMaterials.slice(0, learningMaterialDraftIndex);
  const algorithmGroup = (
    <fieldset className="ai-option-group">
      <legend>사용 알고리즘</legend>
      <div className="ai-option-grid">
        {aiAlgorithmOptions.map(([value, label]) => (
          <label key={value} className="ai-option">
            <input type="checkbox" checked={selectedAlgorithms.some((item) => item.algorithm === value)} onChange={() => toggleAlgorithm(value)} disabled={!aiAnalysis.enabled} />
            {label}
          </label>
        ))}
        <div className="ai-custom-algorithm-option">
          <label className="ai-option ai-custom-algorithm-toggle">
            <input type="checkbox" checked={aiAnalysis.customAlgorithmsEnabled} onChange={(event) => setCustomAlgorithmsEnabled(event.target.checked)} disabled={!aiAnalysis.enabled} />
            기타 알고리즘
          </label>
          {aiAnalysis.customAlgorithmsEnabled && <div className="ai-custom-algorithm-draft">
            <input value={aiAnalysis.customAlgorithmDraft} onChange={(event) => updateAiAnalysis("customAlgorithmDraft", event.target.value)} disabled={!aiAnalysis.enabled} placeholder="예: 단조 스택" aria-label="기타 알고리즘 이름" />
            <button className="secondary-button compact-button" type="button" onClick={addCustomAlgorithm} disabled={!aiAnalysis.enabled || !aiAnalysis.customAlgorithmDraft.trim()}>추가</button>
          </div>}
        </div>
      </div>
      {(selectedAlgorithms.length > 0 || customAlgorithms.length > 0) && (
        <div className="ai-selected-algorithms">
          <p className="form-hint">선택한 알고리즘의 사용 조건을 설정하세요.</p>
          {selectedAlgorithms.map((item) => {
            const label = aiAlgorithmOptions.find(([value]) => value === item.algorithm)?.[1] ?? item.algorithm;
            return <div className="ai-algorithm-rule" key={item.algorithm}><span>{label}</span><select value={item.level} onChange={(event) => updateAlgorithmLevel(item.algorithm, event.target.value)} disabled={!aiAnalysis.enabled}><option value="RECOMMENDED">권장</option><option value="REQUIRED">필수</option></select><button className="ai-remove-button" type="button" onClick={() => toggleAlgorithm(item.algorithm)} disabled={!aiAnalysis.enabled} aria-label={`${label} 선택 해제`}><X size={14} /></button></div>;
          })}
          {customAlgorithms.map((item, index) => <div className="ai-algorithm-rule" key={`custom-algorithm-${index}`}>
            <span>{item.name}</span>
            <select value={item.level} onChange={(event) => updateCustomAlgorithm(index, "level", event.target.value)} disabled={!aiAnalysis.enabled} aria-label={`${item.name} 조건`}><option value="RECOMMENDED">권장</option><option value="REQUIRED">필수</option></select>
            <button className="ai-remove-button" type="button" onClick={() => removeCustomAlgorithm(index)} disabled={!aiAnalysis.enabled} aria-label={`${item.name} 삭제`}><X size={14} /></button>
          </div>)}
        </div>
      )}
      <p className="form-hint">‘필수’는 AI 분석과 운영자 검토에 반영됩니다. 실제 점수는 테스트 결과를 기준으로 합니다.</p>
    </fieldset>
  );
  return <>
    <div className="ai-analysis-heading">
      <div>
        <h3>AI 분석 기준 및 참고자료</h3>
        <p className="form-hint">채점 결과와 함께 AI가 피드백을 작성할 때 사용할 기준입니다. 숨김 테스트와 모범 답안은 응시자에게 공개되지 않습니다.</p>
      </div>
      <label className="ai-toggle"><input type="checkbox" checked={aiAnalysis.enabled} onChange={(event) => updateAiAnalysis("enabled", event.target.checked)} /> AI 분석 사용</label>
    </div>
    {aiAnalysis.enabled ? <>
    {optionGroup("평가 기준", "rubrics", aiRubricOptions, "customRubrics", "customRubricsEnabled", "customRubricDraft", "기타 평가 기준", "예: 함수 분리와 재사용성")}
    {optionGroup("대표 오답 패턴", "mistakePatterns", aiMistakeOptions, "customMistakes", "customMistakesEnabled", "customMistakeDraft", "기타 오답 패턴", "예: 초기값을 고정 상수로 설정")}
    {algorithmGroup}
    <div className="ai-complexity-grid">
      <ComplexityOptionGroup title="예상 시간복잡도" name="expectedTimeComplexity" value={aiAnalysis.expectedTimeComplexity} onChange={(value) => updateAiAnalysis("expectedTimeComplexity", value)} options={[["", "모르겠어요 / 선택 안 함"], ["O(1)", "O(1) · 상수"], ["O(log N)", "O(log N) · 로그"], ["O(N)", "O(N) · 선형"], ["O(N log N)", "O(N log N) · 선형로그"], ["O(N²)", "O(N²) · 제곱"], ["O(2^N)", "O(2^N) · 지수"]]} disabled={!aiAnalysis.enabled} />
      <ComplexityOptionGroup title="예상 공간복잡도" name="expectedSpaceComplexity" value={aiAnalysis.expectedSpaceComplexity} onChange={(value) => updateAiAnalysis("expectedSpaceComplexity", value)} options={[["", "모르겠어요 / 선택 안 함"], ["O(1)", "O(1) · 추가 공간 없음"], ["O(log N)", "O(log N) · 로그"], ["O(N)", "O(N) · 선형"], ["O(N log N)", "O(N log N) · 선형로그"], ["O(N²)", "O(N²) · 제곱"]]} disabled={!aiAnalysis.enabled} />
    </div>
    <section className="ai-material-section">
      <div className="section-title-row"><div><h3>학습 자료 링크</h3><p className="form-hint">분석 결과에 연결할 개념 설명이나 공식 문서입니다.</p></div><button className="secondary-button compact-button" type="button" onClick={addLearningMaterial} disabled={!aiAnalysis.enabled}>링크 추가</button></div>
      <div className="ai-material-row ai-material-draft-row">
        <label>자료명<input value={learningMaterials[learningMaterialDraftIndex]?.title ?? ""} onChange={(event) => updateLearningMaterial(learningMaterialDraftIndex, "title", event.target.value)} disabled={!aiAnalysis.enabled} placeholder="예: 배열 순회 기초" /></label>
        <label>URL<input type="url" value={learningMaterials[learningMaterialDraftIndex]?.url ?? ""} onChange={(event) => updateLearningMaterial(learningMaterialDraftIndex, "url", event.target.value)} disabled={!aiAnalysis.enabled} placeholder="https://..." /></label>
      </div>
      {savedLearningMaterials.length > 0 && <div className="ai-selected-algorithms ai-selected-learning-materials">
        <p className="form-hint">추가한 학습 자료</p>
        {savedLearningMaterials.map((material, index) => {
          const materialUrl = String(material.url ?? "").trim();
          return <div className="ai-algorithm-rule" key={`learning-${index}`}>
            <span className="ai-learning-material-summary"><strong>{material.title || "제목 없는 자료"}</strong>{isHttpUrl(materialUrl) ? <a href={materialUrl} target="_blank" rel="noopener noreferrer">{materialUrl}</a> : <small>{materialUrl}</small>}</span>
            <button className="ai-remove-button" type="button" onClick={() => removeLearningMaterial(index)} disabled={!aiAnalysis.enabled} aria-label={`${material.title || material.url} 삭제`}><X size={14} /></button>
          </div>;
        })}
      </div>}
    </section>
    <section className="ai-material-section">
      <div className="section-title-row"><div><h3>참고 파일 첨부</h3><p className="form-hint">TXT, Markdown, JSON, CSV 파일만 지원하며 파일 내용은 AI 분석 참고용으로 저장됩니다. 파일당 250KB 이하.</p></div><label className="secondary-button compact-button file-button"><FileUp size={14} /> 파일 첨부<input type="file" accept=".txt,.md,.markdown,.json,.csv,text/plain,text/markdown,application/json,text/csv" onChange={uploadReferenceMaterial} disabled={!aiAnalysis.enabled} /></label></div>
      {aiAnalysis.referenceMaterials.length > 0 ? <div className="ai-upload-list">{aiAnalysis.referenceMaterials.map((material, index) => <div className="ai-upload-item" key={material.name + index}><span>{material.name}</span><button className="text-button" type="button" onClick={() => removeReferenceMaterial(index)}>삭제</button></div>)}</div> : <p className="empty-state">첨부한 참고 파일이 없습니다.</p>}
    </section>
    </> : <div className="ai-disabled-summary"><strong>AI 분석을 사용하지 않습니다.</strong><p>문제 등록과 테스트 채점에는 영향을 주지 않습니다. 필요한 경우 위 스위치를 켜 세부 기준을 설정하세요.</p></div>}
  </>;
}

function TestCaseEditor({ collection, cases, addTestCase, removeTestCase, updateTestCase, error }) {
  const isPublic = collection === "publicExamples";
  return <section className="coding-test-section" id={`coding-field-${collection}`} tabIndex="-1"><div className="section-title-row"><div><h3>{isPublic ? "공개 예제" : "숨김 테스트"} <span className="required-mark">필수</span></h3><p className="form-hint">{isPublic ? "응시자에게 표시되는 예제입니다." : "실제 채점 기준으로만 사용하며 응시자에게 표시하지 않습니다."}</p></div><button className="secondary-button compact-button" type="button" onClick={() => addTestCase(collection)}>추가</button></div>{error && <span className="coding-field-error" role="alert">{error}</span>}{cases.map((testCase, index) => <div className="test-case-card" key={`${collection}-${index}`}><div className="section-title-row"><strong>{isPublic ? "예제" : "숨김 테스트"} {index + 1}</strong>{cases.length > 1 && <button className="text-button" type="button" onClick={() => removeTestCase(collection, index)}>삭제</button>}</div><label>입력<textarea value={testCase.input} onChange={(event) => updateTestCase(collection, index, "input", event.target.value)} /></label><label>기대 출력<textarea value={testCase.expectedOutput} onChange={(event) => updateTestCase(collection, index, "expectedOutput", event.target.value)} /></label>{isPublic && <label>설명 <span className="text-muted">(선택)</span><input value={testCase.explanation} onChange={(event) => updateTestCase(collection, index, "explanation", event.target.value)} /></label>}</div>)}</section>;
}

function PreviewDetail({ title, content }) {
  if (!content) return null;
  return <section className="exam-preview-detail"><strong>{title}</strong><p>{content}</p></section>;
}
