import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  Copy,
  ExternalLink,
  Mail,
  Pencil,
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

export default function ManagerExamDetailPage() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [assignedCandidateIds, setAssignedCandidateIds] = useState([]);
  const [questionForm, setQuestionForm] = useState(initialCodingProblem);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [candidateForm, setCandidateForm] = useState({ name: "", email: "" });
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [mailPreviews, setMailPreviews] = useState([]);
  const [copiedEntryLink, setCopiedEntryLink] = useState("");
  const [activeManagementPanel, setActiveManagementPanel] = useState("questions");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const headers = { headers: authHeaders() };

  const load = async () => {
    const [examResponse, candidateResponse, questionResponse, resultResponse] =
      await Promise.all([
        api.get("/manager/exams", headers),
        api.get("/manager/candidates", headers),
        api.get(`/manager/exams/${examId}/questions`, headers),
        api.get(
          `/manager/results?examId=${encodeURIComponent(examId)}`,
          headers,
        ),
      ]);
    setExam(examResponse.data.find((item) => item.id === examId) || null);
    setCandidates(candidateResponse.data);
    setQuestions(questionResponse.data);
    setAssignedCandidateIds(
      resultResponse.data.map((item) => item.candidateId),
    );
    setSelectedCandidateIds((current) =>
      current.filter((candidateId) =>
        candidateResponse.data.some(
          (candidate) => candidate.id === candidateId,
        ),
      ),
    );
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
      setMessage(
        editingQuestionId
          ? "코딩 문제 수정 사항을 저장했습니다."
          : "코딩 문제가 등록되었습니다. 숨김 테스트와 모범 답안은 응시자에게 공개되지 않습니다.",
      );
      await load();
    } catch (reason) {
      setMessage(apiErrorMessage(reason, "문제 등록에 실패했습니다."));
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
      setMessage(
        "기존 객관식 문제는 현재 읽기 전용입니다. 새 코딩 문제만 이 화면에서 수정할 수 있습니다.",
      );
      return;
    }
    setQuestionForm(questionToForm(question));
    setEditingQuestionId(question.id);
    setMessage(`“${question.title}” 문제를 수정 중입니다.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelQuestionEdit = () => {
    setQuestionForm(initialCodingProblem());
    setEditingQuestionId("");
    setMessage("새 코딩 문제 등록으로 전환했습니다.");
  };

  const createCandidate = async (event) => {
    event.preventDefault();
    try {
      await api.post(
        "/manager/candidates",
        { ...candidateForm, organizationId: exam.organizationId },
        headers,
      );
      setCandidateForm({ name: "", email: "" });
      setMessage("응시자가 등록되었습니다.");
      await load();
    } catch (reason) {
      setMessage(apiErrorMessage(reason, "응시자 등록에 실패했습니다."));
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

  const sendInvitations = async () => {
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
      setMessage(
        data.deliveryStatus === "SENT"
          ? `${data.count}명에게 초대 메일을 전송했습니다.`
          : `${data.count}명 초대 정보가 생성되었습니다. 메일 서버 연결 전이라 미리보기 상태입니다.`,
      );
      await load();
    } catch (reason) {
      setMessage(
        apiErrorMessage(reason, "대상자 배정 또는 초대에 실패했습니다."),
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
        setMessage(
          "초대 링크를 복사하지 못했습니다. 아래 링크를 직접 선택해 복사해주세요.",
        );
        return;
      }
    }
    setCopiedEntryLink(entryLink);
    setMessage("초대 링크를 클립보드에 복사했습니다.");
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
      setMessage("배정된 대상자를 먼저 선택해주세요.");
      return;
    }
    try {
      const { data } = await api.delete(
        `/manager/exams/${examId}/assignments`,
        { ...headers, data: { candidateIds } },
      );
      setSelectedCandidateIds([]);
      setMessage(
        `${data.removedCount}명의 시험 대상자 배정을 해제했습니다. 응시자 등록 정보는 유지됩니다.`,
      );
      await load();
    } catch (reason) {
      setMessage(
        apiErrorMessage(reason, "시험 대상자 배정을 해제하지 못했습니다."),
      );
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
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">EXAM DETAIL</span>
          <h1>{exam.title}</h1>
          <p>
            {exam.date} · {exam.duration} · {exam.questions}
          </p>
        </div>
        <span className="status-badge approved">{exam.status}</span>
      </div>
      {message && <div className="workspace-alert">{message}</div>}
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
            배정 {assignedCandidateIds.length}명
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
          <button className="primary-button" type="submit">
            <Users size={16} /> 응시자 등록
          </button>
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
        <div className="candidate-toolbar">
          <label className="select-all-control">
            <input
              type="checkbox"
              checked={allCandidatesSelected}
              onChange={toggleAllCandidates}
              disabled={!scopedCandidates.length}
            />
            <span>전체 선택</span>
          </label>
          <span>
            {selectedCandidateIds.length}명 선택 · {selectedAssignedCount}명
            배정됨
          </span>
        </div>
        <div className="candidate-check-list">
          {scopedCandidates.map((candidate) => (
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
              </span>
              {assignedCandidateIds.includes(candidate.id) && (
                <em className="assignment-state">배정됨</em>
              )}
            </label>
          ))}
          {!scopedCandidates.length && (
            <p className="empty-state">응시자 이메일을 먼저 등록해주세요.</p>
          )}
        </div>
        <div className="candidate-action-row">
          <button
            className="primary-button"
            type="button"
            disabled={!selectedCandidateIds.length}
            onClick={sendInvitations}
          >
            <Mail size={16} /> 선택 대상자 배정 및 초대
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={!selectedAssignedCount}
            onClick={removeAssignments}
          >
            <Trash2 size={16} /> 선택 대상자 배정 해제
          </button>
          <span className="action-hint">
            <CheckSquare size={14} /> 배정 해제해도 응시자 등록 정보는 삭제되지
            않습니다.
          </span>
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
                    <span>{preview.examName}</span>
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
