import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  Copy,
  ExternalLink,
  FileUp,
  Mail,
  Pencil,
  Save,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage, authHeaders } from "../api/client";

const initialCodingProblem = () => ({
  title: "",
  languages: ["Python"],
  description: "",
  inputFormat: "",
  outputFormat: "",
  constraints: "",
  publicExamples: [{ input: "", expectedOutput: "", explanation: "" }],
  hiddenTestCases: [{ input: "", expectedOutput: "" }],
  judgeMode: "EXACT",
  numericTolerance: 0,
  customJudgeCode: "",
  referenceSolutions: { Python: "", Java: "", JavaScript: "" },
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
    JavaScript: "",
    ...(question.referenceSolutions ?? {}),
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [candidateToDelete, setCandidateToDelete] = useState(null);
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

  const scopedCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) => candidate.organizationId === exam?.organizationId,
      ),
    [candidates, exam],
  );
  const allCandidatesSelected =
    scopedCandidates.length > 0 &&
    scopedCandidates.every((candidate) =>
      selectedCandidateIds.includes(candidate.id),
    );
  const selectedAssignedCount = selectedCandidateIds.filter((candidateId) =>
    assignedCandidateIds.includes(candidateId),
  ).length;
  const visibleCandidates = scopedCandidates.filter((candidate) =>
    `${candidate.name} ${candidate.email}`.toLowerCase().includes(candidateSearch.trim().toLowerCase()),
  );
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



  const createQuestion = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...questionForm,
        type: "CODING",
        numericTolerance: Number(questionForm.numericTolerance),
      };
      if (editingQuestionId)
        await api.patch(
          `/manager/exams/${examId}/questions/${editingQuestionId}`,
          payload,
          headers,
        );
      else
        await api.post(`/manager/exams/${examId}/questions`, payload, headers);
      setQuestionForm(initialCodingProblem());
      setEditingQuestionId("");
      showMessage(
        editingQuestionId
          ? "코딩 문제 수정 사항을 저장했습니다."
          : "코딩 문제가 등록되었습니다. 숨김 테스트와 모범 답안은 응시자에게 공개되지 않습니다.",
      );
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "문제 등록에 실패했습니다."), "error");
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
    if (question.type !== "CODING") {
      showMessage(
        "기존 객관식 문제는 현재 읽기 전용입니다. 새 코딩 문제만 이 화면에서 수정할 수 있습니다.",
      );
      return;
    }
    setQuestionForm(questionToForm(question));
    setEditingQuestionId(question.id);
    showMessage(`“${question.title}” 문제를 수정 중입니다.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelQuestionEdit = () => {
    setQuestionForm(initialCodingProblem());
    setEditingQuestionId("");
    showMessage("새 코딩 문제 등록으로 전환했습니다.");
  };

  const createCandidate = async (event) => {
    event.preventDefault();
    try {
      const normalizedEmail = candidateForm.email.trim().toLowerCase();
      const existingCandidate = organizationCandidates.find(
        (candidate) => candidate.email === normalizedEmail,
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

  const toggleAllCandidates = () =>
    setSelectedCandidateIds(
      allCandidatesSelected
        ? []
        : scopedCandidates.map((candidate) => candidate.id),
    );

  const deleteCandidate = async (candidateId) => {
    if (!candidateId) return;
    try {
      await api.delete(`/manager/candidates/${candidateId}`, headers);
      showMessage("응시자 정보를 삭제했습니다.");
      setCandidateToDelete(null);
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "응시자 정보를 삭제하지 못했습니다."), "error");
    }
  };

  const deleteSelectedCandidates = async () => {
    if (selectedAdminCandidateIds.length === 0) return;
    if (!window.confirm(`${selectedAdminCandidateIds.length}명의 응시자를 목록에서 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      await api.delete("/manager/candidates/batch-delete", {
        ...headers,
        data: { candidateIds: selectedAdminCandidateIds },
      });
      showMessage(`${selectedAdminCandidateIds.length}명의 응시자 정보를 삭제했습니다.`);
      setSelectedAdminCandidateIds([]);
      await load();
    } catch (reason) {
      showMessage(apiErrorMessage(reason, "응시자 정보를 삭제하지 못했습니다."), "error");
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
    if (selectedCandidateIds.some((candidateId) => !scopedCandidates.find((candidate) => candidate.id === candidateId)?.birthDate)) {
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
      // 전체 목록을 다시 불러오는 대신 배정 상태만 갱신합니다.
      // await load();
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
            {exam.date} · {exam.duration} · {exam.questions}
          </p>
        </div>
      </div>
      {message && <div className={`workspace-alert ${messageType === "error" ? "error" : ""}`}>{message}</div>}
      <nav className="exam-detail-tabs" aria-label="시험 운영">
        <button
          className={`exam-detail-tab ${activeManagementPanel === "questions" ? "active" : ""}`}
          type="button"
          aria-pressed={activeManagementPanel === "questions"}
          onClick={() => setActiveManagementPanel("questions")}
        >
          문제 출제
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
            응시자 {scopedCandidates.length}명
          </span>
        </button>
        <button
          className={`exam-detail-tab ${activeManagementPanel === "invitations" ? "active" : ""}`}
          type="button"
          aria-pressed={activeManagementPanel === "invitations"}
          onClick={() => setActiveManagementPanel("invitations")}
        >
          초대 관리
          <span className="exam-detail-tab-count">
            {scopedCandidates.length}/{invitedCandidateIds.length}명
          </span>
        </button>
      </nav>

      {activeManagementPanel === "questions" && (
        <form
          id="question-management"
          className="data-panel form-panel coding-problem-form"
          onSubmit={createQuestion}
        >
          <div className="panel-heading">
            <div>
              <h2>코딩 문제 출제</h2>
              <p>
                정답 코드 대신 공개 예제와 숨김 테스트 케이스로 채점 기준을
                등록합니다.
              </p>
            </div>
            <BookOpen size={20} />
          </div>
          <details className="coding-section" open>
            <summary>1. 문제 기본 정보</summary>
            <div className="coding-section-content">
              <label>
                문제 제목
                <input
                  value={questionForm.title}
                  onChange={(event) =>
                    setQuestionForm({
                      ...questionForm,
                      title: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <div className="language-options">
                {["Python", "Java", "JavaScript"].map((language) => (
                  <label key={language}>
                    <input
                      type="checkbox"
                      checked={questionForm.languages.includes(language)}
                      onChange={() => toggleLanguage(language)}
                    />{" "}
                    {language}
                  </label>
                ))}
              </div>
            </div>
          </details>
          <details className="coding-section">
            <summary>2. 문제 설명과 입출력</summary>
            <div className="coding-section-content">
              <label>
                문제 설명
                <textarea
                  value={questionForm.description}
                  onChange={(event) =>
                    setQuestionForm({
                      ...questionForm,
                      description: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                입력 형식
                <textarea
                  value={questionForm.inputFormat}
                  onChange={(event) =>
                    setQuestionForm({
                      ...questionForm,
                      inputFormat: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                출력 형식
                <textarea
                  value={questionForm.outputFormat}
                  onChange={(event) =>
                    setQuestionForm({
                      ...questionForm,
                      outputFormat: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                제한
                <textarea
                  value={questionForm.constraints}
                  onChange={(event) =>
                    setQuestionForm({
                      ...questionForm,
                      constraints: event.target.value,
                    })
                  }
                  required
                />
              </label>
            </div>
          </details>
          <details className="coding-section">
            <summary>3. 공개 예제</summary>
            <div className="coding-section-content">
              <div className="section-title-row">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => addTestCase("publicExamples")}
                >
                  예제 추가
                </button>
              </div>
              {questionForm.publicExamples.map((testCase, index) => (
                <div className="test-case-card" key={`public-${index}`}>
                  <div className="section-title-row">
                    <strong>예제 {index + 1}</strong>
                    {questionForm.publicExamples.length > 1 && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => removeTestCase("publicExamples", index)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <label>
                    입력
                    <textarea
                      value={testCase.input}
                      onChange={(event) =>
                        updateTestCase(
                          "publicExamples",
                          index,
                          "input",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    기대 출력
                    <textarea
                      value={testCase.expectedOutput}
                      onChange={(event) =>
                        updateTestCase(
                          "publicExamples",
                          index,
                          "expectedOutput",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    설명 <span className="text-muted">(선택)</span>
                    <input
                      value={testCase.explanation}
                      onChange={(event) =>
                        updateTestCase(
                          "publicExamples",
                          index,
                          "explanation",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </details>
          <details className="coding-section">
            <summary>4. 숨김 테스트</summary>
            <div className="coding-section-content">
              <div className="section-title-row">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => addTestCase("hiddenTestCases")}
                >
                  테스트 추가
                </button>
              </div>
              <p className="form-hint">
                응시 화면에는 공개되지 않으며 실제 채점 기준으로 사용됩니다.
              </p>
              {questionForm.hiddenTestCases.map((testCase, index) => (
                <div className="test-case-card" key={`hidden-${index}`}>
                  <div className="section-title-row">
                    <strong>숨김 테스트 {index + 1}</strong>
                    {questionForm.hiddenTestCases.length > 1 && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => removeTestCase("hiddenTestCases", index)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <label>
                    입력
                    <textarea
                      value={testCase.input}
                      onChange={(event) =>
                        updateTestCase(
                          "hiddenTestCases",
                          index,
                          "input",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    기대 출력
                    <textarea
                      value={testCase.expectedOutput}
                      onChange={(event) =>
                        updateTestCase(
                          "hiddenTestCases",
                          index,
                          "expectedOutput",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>
                </div>
              ))}
            </div>
          </details>
          <details className="coding-section">
            <summary>5. 채점 설정</summary>
            <div className="coding-section-content">
              <label>
                비교 방식
                <select
                  value={questionForm.judgeMode}
                  onChange={(event) =>
                    setQuestionForm({
                      ...questionForm,
                      judgeMode: event.target.value,
                    })
                  }
                >
                  <option value="EXACT">정확히 일치</option>
                  <option value="IGNORE_WHITESPACE">
                    공백·줄바꿈 차이 무시
                  </option>
                  <option value="NUMERIC_TOLERANCE">숫자 오차 허용</option>
                  <option value="CUSTOM">별도 채점 코드</option>
                </select>
              </label>
              {questionForm.judgeMode === "NUMERIC_TOLERANCE" && (
                <label>
                  허용 오차
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={questionForm.numericTolerance}
                    onChange={(event) =>
                      setQuestionForm({
                        ...questionForm,
                        numericTolerance: event.target.value,
                      })
                    }
                    required
                  />
                </label>
              )}
              {questionForm.judgeMode === "CUSTOM" && (
                <label>
                  별도 채점 코드
                  <textarea
                    className="code-editor"
                    value={questionForm.customJudgeCode}
                    onChange={(event) =>
                      setQuestionForm({
                        ...questionForm,
                        customJudgeCode: event.target.value,
                      })
                    }
                    required
                  />
                </label>
              )}
            </div>
          </details>
          <details className="coding-section">
            <summary>
              6. 모범 답안 <span className="text-muted">(선택)</span>
            </summary>
            <div className="coding-section-content">
              <p className="form-hint">
                문제 검증과 테스트 데이터 생성용입니다. 응시자 코드와 직접
                비교하지 않습니다.
              </p>
              {["Python", "Java", "JavaScript"].map((language) => (
                <label key={language}>
                  {language}
                  <textarea
                    className="code-editor"
                    value={questionForm.referenceSolutions[language]}
                    onChange={(event) =>
                      setQuestionForm({
                        ...questionForm,
                        referenceSolutions: {
                          ...questionForm.referenceSolutions,
                          [language]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <div className="coding-form-actions">
            <button className="primary-button" type="submit">
              <BookOpen size={16} />{" "}
              {editingQuestionId ? "수정 사항 저장" : "코딩 문제 등록"}
            </button>
            {editingQuestionId && (
              <button
                className="secondary-button"
                type="button"
                onClick={cancelQuestionEdit}
              >
                새 문제 등록
              </button>
            )}
          </div>
          <div className="question-list">
            {questions.map((question, index) => (
              <button
                className={`question-list-row ${editingQuestionId === question.id ? "selected" : ""}`}
                type="button"
                key={question.id}
                onClick={() => editQuestion(question)}
              >
                <strong>
                  {index + 1}.{" "}
                  {question.type === "CODING"
                    ? question.title
                    : question.prompt}
                </strong>
                <span>
                  {question.type === "CODING"
                    ? `${question.hiddenTestCases?.length ?? 0}개 숨김 테스트`
                    : (question.options ?? []).join(" · ")}
                </span>
                <span className="question-edit-hint">
                  {question.type === "CODING" ? (
                    <>
                      <Pencil size={14} /> 열어 수정
                    </>
                  ) : (
                    "객관식"
                  )}
                </span>
              </button>
            ))}
          </div>
        </form>
      )}

      {activeManagementPanel === "candidates" && (
        <form
          id="candidate-management"
          className="data-panel form-panel"
          onSubmit={createCandidate}
        >
          <div className="panel-heading">
            <div>
              <h2>응시자 이메일 등록</h2>
              <p>이 시험의 조직에 응시자를 추가합니다.</p>
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
                <h2>등록된 응시자 목록</h2>
                <p>현재 조직에 등록된 전체 응시자 목록입니다.</p>
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
                <strong>{candidateToDelete.name}</strong> 응시자를 목록에서 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                <div className="candidate-row-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="secondary-button compact-button" onClick={() => setCandidateToDelete(null)}>취소</button>
                  <button className="danger-button compact-button" onClick={() => deleteCandidate(candidateToDelete.id)}>삭제 확인</button>
                </div>
              </div>
            )}
            <div className="floating-action-bar static">
              <div className="floating-action-bar-content">
                <span>{selectedAdminCandidateIds.length}명 선택됨</span>
                <div className="floating-action-buttons">
                  {selectedAdminCandidateIds.length > 0 && (
                    <button className="danger-button" type="button" onClick={deleteSelectedCandidates}>
                      <Trash2 size={16} /> 선택 삭제 ({selectedAdminCandidateIds.length}명)
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
            <p>
              전체 선택으로 일괄 배정·초대하거나 선택한 대상자의 배정을 해제할
              수 있습니다.
            </p>
          </div>
          <Send size={20} />
        </div>
        <div className="candidate-controls-group">
          <div className="candidate-toolbar">
            <label className="select-all-control"><input type="checkbox" checked={allCandidatesSelected} onChange={toggleAllCandidates} disabled={!scopedCandidates.length} /><span>전체 선택</span></label>
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
    </section>
  );
}
