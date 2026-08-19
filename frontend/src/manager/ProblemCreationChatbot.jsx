import React, { useEffect, useState } from "react";
import { Bot, Check, Sparkles } from "lucide-react";
import { ALGORITHM_OPTIONS, CODING_LANGUAGE_OPTIONS, REQUIREMENT_OPTIONS, SPACE_COMPLEXITY_OPTIONS, TIME_COMPLEXITY_OPTIONS, candidateToProblem, validateRequirements } from "./problemChatbotWorkflow.mjs";
import { api, apiErrorMessage, authHeaders } from "../api/client";
import { generateProblemCandidates } from "./problemCandidateService.mjs";

const emptyConditions = { algorithmRequirements: [], expectedTimeComplexity: "", expectedSpaceComplexity: "", solutionRequirements: "", prohibitedApproaches: "" };
const empty = { difficulty: "", type: "", scope: "", languages: [], authoringConditions: emptyConditions };
const typeName = (value) => value === "CODING" ? "코딩 문제" : "객관식 문제";

export default function ProblemCreationChatbot({ examId, onApplyCoding, onEnqueue, onGenerationStarted, onGenerationFailed, onRequirementsChange, restoredRequirements, codingOnly = false, completed = false, resetKey = 0, restoreKey = 0, autoFocus = false }) {
  const initialRequirements = codingOnly ? { ...empty, type: "CODING" } : empty;
  const [requirements, setRequirements] = useState(initialRequirements);
  const restoredRequirementsRef = React.useRef(restoredRequirements);
  restoredRequirementsRef.current = restoredRequirements;
  const [errors, setErrors] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [complete, setComplete] = useState(completed);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [agentSteps, setAgentSteps] = useState([]);
  const [revising, setRevising] = useState(false);
  useEffect(() => setComplete(completed), [completed]);
  useEffect(() => onRequirementsChange?.(requirements), [onRequirementsChange, requirements]);
  useEffect(() => {
    setRequirements(codingOnly ? { ...empty, type: "CODING" } : empty);
    setErrors({});
    setCandidates([]);
    setSelected(null);
    setFeedback("");
    setFeedbackError("");
    setComplete(false);
    setGenerating(false);
    setGenerationError(null);
    setAgentSteps([]);
    setRevising(false);
  }, [resetKey, codingOnly]);
  useEffect(() => {
    if (!restoreKey || !restoredRequirementsRef.current) return;
    setRequirements({
      ...(codingOnly ? { ...empty, type: "CODING" } : empty),
      ...restoredRequirementsRef.current,
      authoringConditions: { ...emptyConditions, ...(restoredRequirementsRef.current.authoringConditions ?? {}) },
    });
    setErrors({});
    setCandidates([]);
    setSelected(null);
    setFeedback("");
    setFeedbackError("");
    setComplete(false);
    setGenerationError(null);
    setAgentSteps([]);
  }, [restoreKey, codingOnly]);
  const visibleAgentSteps = agentSteps.filter((step) => !step.includes("요구사항 검증 완료"));
  const update = (field, value) => { setRequirements((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: "" })); };
  const toggleLanguage = (language) => {
    setRequirements((current) => ({ ...current, languages: current.languages.includes(language) ? current.languages.filter((item) => item !== language) : [...current.languages, language] }));
    setErrors((current) => ({ ...current, languages: "" }));
  };
  const updateCondition = (field, value) => setRequirements((current) => ({
    ...current,
    authoringConditions: { ...current.authoringConditions, [field]: value },
  }));
  const toggleAlgorithm = (algorithm) => setRequirements((current) => {
    const selected = current.authoringConditions.algorithmRequirements ?? [];
    const exists = selected.some((item) => item.algorithm === algorithm);
    return {
      ...current,
      authoringConditions: {
        ...current.authoringConditions,
        algorithmRequirements: exists
          ? selected.filter((item) => item.algorithm !== algorithm)
          : [...selected, { algorithm, level: "RECOMMENDED" }],
      },
    };
  });
  const updateAlgorithmLevel = (algorithm, level) => updateCondition(
    "algorithmRequirements",
    requirements.authoringConditions.algorithmRequirements.map((item) => item.algorithm === algorithm ? { ...item, level } : item),
  );
  const create = async () => {
    const next = validateRequirements(requirements);
    if (Object.keys(next).length) { setErrors(next); return; }
    if (onEnqueue) { onEnqueue(JSON.parse(JSON.stringify(requirements))); return; }
    onGenerationStarted?.();
    setGenerating(true); setGenerationError(null); setAgentSteps(["요구사항을 확인하는 중…"]);
    try {
      const result = await generateProblemCandidates(examId, requirements, (step) => setAgentSteps((current) => [...current.filter((item) => item !== "요구사항을 확인하는 중…"), step]));
      setCandidates(result.candidates); setAgentSteps(result.agentSteps ?? []); setSelected(null); setComplete(false);
      if (codingOnly && result.candidates.length > 0) {
        const problem = candidateToProblem(result.candidates[0]);
        onApplyCoding(problem.form);
        setSelected(result.candidates[0]);
        setComplete(true);
      }
    } catch (error) {
      onGenerationFailed?.(error);
      const failure = error.aiFailure;
      setGenerationError({
        message: error.message || "AI 문제 시안을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        detail: failure?.detail,
        provider: failure?.provider,
        model: failure?.model,
        status: failure?.providerStatus,
        code: failure?.providerCode || failure?.code,
      });
    } finally { setGenerating(false); }
  };
  const revise = async () => {
    if (!feedback.trim()) { setFeedbackError("수정할 내용을 입력해 주세요."); return; }
    setRevising(true); setFeedbackError("");
    try {
      const { data } = await api.post(`/manager/exams/${examId}/ai-problem-candidates/refine`, { candidate: selected, feedback }, { headers: authHeaders() });
      setSelected(data.candidate);
      setCandidates((items) => items.map((item) => item.id === data.candidate.id ? data.candidate : item));
      setFeedback("");
    } catch (error) {
      setFeedbackError(apiErrorMessage(error, "AI가 수정 요청을 반영하지 못했습니다. 다시 시도해 주세요."));
    } finally { setRevising(false); }
  };
  const confirm = () => { const problem = candidateToProblem(selected); onApplyCoding(problem.form); setComplete(true); };
  if (complete) return <section className={`problem-chatbot${codingOnly ? " coding-only" : ""}`} aria-label="문제 시안 만들기"><div className="problem-chatbot-body"><div className="chat-complete"><Check size={20} /><div><strong>문제 작성란에 적용했습니다.</strong><p>문제 내용을 수정한 경우 모범 답안을 다시 생성해 주세요.</p></div></div></div></section>;
  return <section className={`problem-chatbot${codingOnly ? " coding-only" : ""}`} aria-label="문제 시안 만들기">
    <div className="problem-chatbot-body">
      {!candidates.length && <><div className="chat-requirements-grid"><Select label="난이도" field="difficulty" options={REQUIREMENT_OPTIONS.difficulty} value={requirements.difficulty} update={update} error={errors.difficulty} /><Select label="문제 유형" field="type" options={REQUIREMENT_OPTIONS.type} value={requirements.type} update={update} error={errors.type} format={typeName} />{requirements.type === "CODING" && <fieldset className="chat-language-picker"><legend>사용 언어 <b>필수</b></legend><div>{CODING_LANGUAGE_OPTIONS.map((language) => <label key={language}><input type="checkbox" checked={requirements.languages.includes(language)} onChange={() => toggleLanguage(language)} /> {language}</label>)}</div>{errors.languages && <em>{errors.languages}</em>}</fieldset>}<label className="chat-scope"><span className="sr-only">문제 주제 및 요청사항</span><textarea autoFocus={autoFocus} value={requirements.scope} onChange={(event) => update("scope", event.target.value)} placeholder="문제의 주제, 난이도, 상황 또는 반드시 반영할 조건을 입력하세요." />{errors.scope && <em>{errors.scope}</em>}</label>{requirements.type === "CODING" && <AuthoringConditions conditions={requirements.authoringConditions} updateCondition={updateCondition} toggleAlgorithm={toggleAlgorithm} updateAlgorithmLevel={updateAlgorithmLevel} />}</div>{generating && <ol className="agent-step-log in-progress">{visibleAgentSteps.map((step) => <li key={step}><span className="agent-progress-dot" /> {step}</li>)}</ol>}{generationError && <div className="form-error ai-generation-error" role="alert"><strong>{generationError.message}</strong>{generationError.detail && <span>상세 원인: {generationError.detail}</span>}{(generationError.provider || generationError.model) && <small>연결: {[generationError.provider, generationError.model].filter(Boolean).join(" / ")}</small>}{(generationError.status || generationError.code) && <small>오류 식별: {[generationError.status && `HTTP ${generationError.status}`, generationError.code].filter(Boolean).join(" / ")}</small>}</div>}<button className="primary-button" type="button" disabled={generating} onClick={() => create()}><Sparkles size={16} /> {generating ? "문제 자동 생성 중…" : codingOnly ? "문제 자동 생성 및 등록" : "시안 3개 만들기"}</button></>}
      {candidates.length > 0 && !selected && <><div className="chat-message"><Bot size={16} /><div><strong>사용할 시안을 선택하세요.</strong></div></div><ol className="agent-step-log">{visibleAgentSteps.map((step) => <li key={step}><Check size={14} /> {step}</li>)}</ol><div className="chat-candidates">{candidates.map((candidate) => <button type="button" key={candidate.id} onClick={() => setSelected(candidate)}><span>시안 {candidate.seed}</span><strong>{candidate.label}</strong><p>{candidate.summary}</p></button>)}</div></>}
      {selected && !complete && <><div className="chat-message"><Bot size={16} /><div><strong>{selected.label} 시안 검토</strong><p>필요하면 요청사항을 반영한 뒤 문제 작성란에 적용하세요.</p></div></div><div className="chat-review-controls"><label className="chat-feedback">수정 요청<textarea value={feedback} disabled={revising} onChange={(event) => { setFeedback(event.target.value); setFeedbackError(""); }} placeholder="예: 조금 더 쉽게, 예제를 추가해 줘" />{feedbackError && <em>{feedbackError}</em>}</label><div className="chat-actions"><button className="secondary-button" type="button" disabled={revising} onClick={revise}>{revising ? "수정 중…" : "요청 반영"}</button><button className="primary-button" type="button" disabled={revising} onClick={confirm}><Check size={16} /> 문제 작성란에 적용</button><button className="text-button" type="button" disabled={revising} onClick={() => setSelected(null)}>다른 시안 선택</button></div></div><CandidatePreview candidate={selected} /></>}
      {complete && <div className="chat-complete"><Check size={20} /><div><strong>문제 작성란에 적용했습니다.</strong><p>모범 답안을 준비하고 있습니다.</p></div></div>}
    </div>
  </section>;
}

function Select({ label, field, options, value, update, error, format = (item) => item }) { return <label><span className="chat-field-label"><span>{label}</span><b>필수</b></span><select value={value} onChange={(event) => update(field, event.target.value)}><option value="">선택해 주세요</option>{options.map((option) => <option key={option} value={option}>{format(option)}</option>)}</select>{error && <em>{error}</em>}</label>; }

function AuthoringConditions({ conditions, updateCondition, toggleAlgorithm, updateAlgorithmLevel }) {
  return <details className="authoring-conditions">
    <summary><span><strong>세부 출제 조건</strong><small>알고리즘·복잡도·풀이 제약</small></span><em>선택</em></summary>
    <div className="authoring-conditions-body">
      <fieldset><legend>알고리즘</legend><div className="authoring-algorithm-options">{ALGORITHM_OPTIONS.map(([value, label]) => { const selected = conditions.algorithmRequirements.some((item) => item.algorithm === value); return <label className={selected ? "selected" : ""} key={value}><input type="checkbox" checked={selected} onChange={() => toggleAlgorithm(value)} /><span>{label}</span></label>; })}</div>{conditions.algorithmRequirements.length > 0 && <div className="authoring-selected-algorithms"><small>사용 조건</small>{conditions.algorithmRequirements.map((item) => <label className="authoring-algorithm-level" key={item.algorithm}><span>{ALGORITHM_OPTIONS.find(([value]) => value === item.algorithm)?.[1]}</span><select value={item.level} onChange={(event) => updateAlgorithmLevel(item.algorithm, event.target.value)}><option value="RECOMMENDED">권장</option><option value="REQUIRED">필수</option></select></label>)}</div>}</fieldset>
      <div className="authoring-complexity-grid"><label>목표 시간복잡도<select value={conditions.expectedTimeComplexity} onChange={(event) => updateCondition("expectedTimeComplexity", event.target.value)}>{TIME_COMPLEXITY_OPTIONS.map((value) => <option key={value || "none"} value={value}>{value || "지정 안 함"}</option>)}</select></label><label>목표 공간복잡도<select value={conditions.expectedSpaceComplexity} onChange={(event) => updateCondition("expectedSpaceComplexity", event.target.value)}>{SPACE_COMPLEXITY_OPTIONS.map((value) => <option key={value || "none"} value={value}>{value || "지정 안 함"}</option>)}</select></label></div>
      <label>반드시 반영할 풀이 조건<textarea value={conditions.solutionRequirements} onChange={(event) => updateCondition("solutionRequirements", event.target.value)} placeholder="예: 입력을 한 번만 순회할 것" /></label>
      <label>피해야 할 풀이 방식<textarea value={conditions.prohibitedApproaches} onChange={(event) => updateCondition("prohibitedApproaches", event.target.value)} placeholder="예: 내장 정렬 함수 사용 금지" /></label>
    </div>
  </details>;
}

function CandidatePreview({ candidate }) {
  const problem = candidateToProblem(candidate);
  const form = problem.form;
  if (problem.type === "MULTIPLE_CHOICE") return <article className="chat-preview"><header><span>{candidate.label}</span><strong>객관식 문제 미리보기</strong></header><section><h3>문제 내용</h3><p>{form.prompt}</p></section><section><h3>선택지 및 정답</h3><ol>{form.options.map((option) => <li key={option} className={option === form.answer ? "answer" : ""}>{option}{option === form.answer && " (정답)"}</li>)}</ol></section></article>;
  return <article className="chat-preview"><header><span>{candidate.label}</span><strong>적용 전 전체 미리보기</strong></header><section><h3>1. 기본 정보</h3><dl><div><dt>문제 제목</dt><dd>{form.title}</dd></div><div><dt>사용 언어</dt><dd>{form.languages.join(", ")}</dd></div></dl></section><section><h3>2. 문제 내용</h3><PreviewValue title="문제 설명" value={form.description} /><PreviewValue title="입력 형식" value={form.inputFormat} /><PreviewValue title="출력 형식" value={form.outputFormat} /><PreviewValue title="제한" value={form.constraints} /></section><section><h3>3. 테스트 및 채점</h3><p className="chat-judge">채점 방식: 정확히 일치</p>{form.publicExamples.map((item, index) => <TestCase key={`public-${index}`} label={`공개 예제 ${index + 1}`} item={item} />)}{form.hiddenTestCases.map((item, index) => <TestCase key={`hidden-${index}`} label={`비공개 채점 케이스 ${index + 1}`} item={item} hidden />)}</section>{candidate.revisionNotes.length > 0 && <ul className="chat-revisions">{candidate.revisionNotes.map((note, index) => <li key={`${note}-${index}`}>반영됨: {note}</li>)}</ul>}</article>;
}

function PreviewValue({ title, value }) { return <div className="chat-preview-value"><strong>{title}</strong><pre>{value}</pre></div>; }
function TestCase({ label, item, hidden }) { return <div className={`chat-test-case${hidden ? " hidden" : ""}`}><strong>{label}</strong><div><span>입력</span><pre>{item.input}</pre></div><div><span>기대 출력</span><pre>{item.expectedOutput}</pre></div>{item.explanation && <p>{item.explanation}</p>}</div>; }
