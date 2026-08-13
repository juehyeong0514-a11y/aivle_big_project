import React, { useState } from "react";
import { Bot, Check, RefreshCw, Sparkles } from "lucide-react";
import { CODING_LANGUAGE_OPTIONS, REQUIREMENT_OPTIONS, candidateToProblem, validateRequirements } from "./problemChatbotWorkflow.mjs";
import { api, apiErrorMessage, authHeaders } from "../api/client";

const empty = { difficulty: "", type: "", scope: "", languages: [] };
const typeName = (value) => value === "CODING" ? "코딩 문제" : "객관식 문제";

export default function ProblemCreationChatbot({ examId, onApplyCoding, codingOnly = false }) {
  const initialRequirements = codingOnly ? { ...empty, type: "CODING" } : empty;
  const [requirements, setRequirements] = useState(initialRequirements);
  const [errors, setErrors] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [complete, setComplete] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [agentSteps, setAgentSteps] = useState([]);
  const [revising, setRevising] = useState(false);
  const visibleAgentSteps = agentSteps.filter((step) => !step.includes("요구사항 검증 완료"));
  const update = (field, value) => { setRequirements((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: "" })); };
  const toggleLanguage = (language) => {
    setRequirements((current) => ({ ...current, languages: current.languages.includes(language) ? current.languages.filter((item) => item !== language) : [...current.languages, language] }));
    setErrors((current) => ({ ...current, languages: "" }));
  };
  const create = async () => {
    const next = validateRequirements(requirements);
    if (Object.keys(next).length) { setErrors(next); return; }
    setGenerating(true); setGenerationError(""); setAgentSteps(["요구사항을 확인하는 중…"]);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${baseUrl}/manager/exams/${examId}/ai-problem-candidates?stream=1`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ requirements }) });
      if (!response.body) throw new Error("생성 진행 상태를 받을 수 없습니다.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "progress") setAgentSteps((current) => [...current.filter((step) => step !== "요구사항을 확인하는 중…"), event.step]);
          if (event.type === "result") result = event;
          if (event.type === "error") throw new Error(event.message);
        }
        if (done) break;
      }
      if (!result?.candidates) throw new Error("AI 에이전트가 결과를 반환하지 못했습니다.");
      setCandidates(result.candidates); setAgentSteps(result.agentSteps ?? []); setSelected(null); setComplete(false);
    } catch (error) {
      setGenerationError(error.message || "AI 문제 시안을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
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
  const restart = () => { setRequirements(initialRequirements); setErrors({}); setCandidates([]); setSelected(null); setFeedback(""); setComplete(false); setGenerationError(""); setAgentSteps([]); };

  return <section className={`problem-chatbot${codingOnly ? " coding-only" : ""}`} aria-label="AI 문제 만들기">
    <header><div><strong><Bot size={18} /> AI 문제 만들기</strong><span>조건 입력 → 시안 선택 → 수정 → 확정</span></div><button type="button" onClick={restart}><RefreshCw size={14} /> 새로 시작</button></header>
    <div className="problem-chatbot-body">
      {!candidates.length && <><div className="chat-message"><Bot size={16} /><div><strong>어떻게 문제를 만들고 싶으세요?</strong><p>조건을 입력하면 AI가 이 화면 형식에 맞는 완성된 문제 시안 3개를 만들어요.</p></div></div><div className="chat-requirements-grid"><Select label="난이도" field="difficulty" options={REQUIREMENT_OPTIONS.difficulty} value={requirements.difficulty} update={update} error={errors.difficulty} /><Select label="문제 유형" field="type" options={REQUIREMENT_OPTIONS.type} value={requirements.type} update={update} error={errors.type} format={typeName} />{requirements.type === "CODING" && <fieldset className="chat-language-picker"><legend>사용 언어 <b>필수</b></legend><div>{CODING_LANGUAGE_OPTIONS.map((language) => <label key={language}><input type="checkbox" checked={requirements.languages.includes(language)} onChange={() => toggleLanguage(language)} /> {language}</label>)}</div>{errors.languages && <em>{errors.languages}</em>}</fieldset>}<label className="chat-scope">출제 범위 <b>필수</b><textarea value={requirements.scope} onChange={(event) => update("scope", event.target.value)} placeholder="예: 배열과 반복문" />{errors.scope && <em>{errors.scope}</em>}</label></div>{generating && <ol className="agent-step-log in-progress">{visibleAgentSteps.map((step) => <li key={step}><span className="agent-progress-dot" /> {step}</li>)}</ol>}{generationError && <p className="form-error">{generationError}</p>}<button className="primary-button" type="button" disabled={generating} onClick={() => create()}><Sparkles size={16} /> {generating ? "AI 에이전트 실행 중…" : "문제 시안 3개 만들기"}</button></>}
      {candidates.length > 0 && !selected && <><div className="chat-message"><Bot size={16} /><div><strong>문제 생성 에이전트가 시안 3개를 만들었어요.</strong></div></div><ol className="agent-step-log">{visibleAgentSteps.map((step) => <li key={step}><Check size={14} /> {step}</li>)}</ol><div className="chat-candidates">{candidates.map((candidate) => <button type="button" key={candidate.id} onClick={() => setSelected(candidate)}><span>시안 {candidate.seed} · {candidate.label}</span><strong>{candidate.requirements.scope} {candidate.label} 문제</strong><p>{candidate.summary}</p></button>)}</div></>}
      {selected && !complete && <><div className="chat-message"><Bot size={16} /><div><strong>{selected.label} 시안을 선택했어요.</strong><p>실제 적용될 문제 전체를 확인하고, 수정하거나 확정하세요.</p></div></div><CandidatePreview candidate={selected} /><label className="chat-feedback">수정 요청<textarea value={feedback} disabled={revising} onChange={(event) => { setFeedback(event.target.value); setFeedbackError(""); }} placeholder="예: 조금 더 쉽게, 예제를 추가해줘" />{feedbackError && <em>{feedbackError}</em>}</label><div className="chat-actions"><button className="secondary-button" type="button" disabled={revising} onClick={revise}>{revising ? "AI가 수정 중…" : "수정 반영"}</button><button className="primary-button" type="button" disabled={revising} onClick={confirm}><Check size={16} /> 좋아, 이대로 확정할게</button></div><button className="text-button" type="button" disabled={revising} onClick={() => setSelected(null)}>다른 시안 고르기</button></>}
      {complete && <div className="chat-complete"><Check size={20} /><div><strong>완성된 문제를 작성 화면에 적용했어요.</strong><p>기본 정보, 문제 내용, 테스트 및 채점 항목이 모두 채워졌습니다. 검토 후 ‘문제 등록’을 눌러 주세요.</p></div></div>}
    </div>
  </section>;
}

function Select({ label, field, options, value, update, error, format = (item) => item }) { return <label>{label} <b>필수</b><select value={value} onChange={(event) => update(field, event.target.value)}><option value="">선택해 주세요</option>{options.map((option) => <option key={option} value={option}>{format(option)}</option>)}</select>{error && <em>{error}</em>}</label>; }

function CandidatePreview({ candidate }) {
  const problem = candidateToProblem(candidate);
  const form = problem.form;
  if (problem.type === "MULTIPLE_CHOICE") return <article className="chat-preview"><header><span>{candidate.label}</span><strong>객관식 문제 미리보기</strong></header><section><h3>문제 내용</h3><p>{form.prompt}</p></section><section><h3>선택지 및 정답</h3><ol>{form.options.map((option) => <li key={option} className={option === form.answer ? "answer" : ""}>{option}{option === form.answer && " (정답)"}</li>)}</ol></section></article>;
  return <article className="chat-preview"><header><span>{candidate.label}</span><strong>적용 전 전체 미리보기</strong></header><section><h3>1. 기본 정보</h3><dl><div><dt>문제 제목</dt><dd>{form.title}</dd></div><div><dt>사용 언어</dt><dd>{form.languages.join(", ")}</dd></div></dl></section><section><h3>2. 문제 내용</h3><PreviewValue title="문제 설명" value={form.description} /><PreviewValue title="입력 형식" value={form.inputFormat} /><PreviewValue title="출력 형식" value={form.outputFormat} /><PreviewValue title="제한" value={form.constraints} /></section><section><h3>3. 테스트 및 채점</h3><p className="chat-judge">채점 방식: 정확히 일치</p>{form.publicExamples.map((item, index) => <TestCase key={`public-${index}`} label={`공개 예제 ${index + 1}`} item={item} />)}{form.hiddenTestCases.map((item, index) => <TestCase key={`hidden-${index}`} label={`숨김 테스트 ${index + 1}`} item={item} hidden />)}</section>{candidate.revisionNotes.length > 0 && <ul className="chat-revisions">{candidate.revisionNotes.map((note, index) => <li key={`${note}-${index}`}>반영됨: {note}</li>)}</ul>}</article>;
}

function PreviewValue({ title, value }) { return <div className="chat-preview-value"><strong>{title}</strong><pre>{value}</pre></div>; }
function TestCase({ label, item, hidden }) { return <div className={`chat-test-case${hidden ? " hidden" : ""}`}><strong>{label}</strong><div><span>입력</span><pre>{item.input}</pre></div><div><span>기대 출력</span><pre>{item.expectedOutput}</pre></div>{item.explanation && <p>{item.explanation}</p>}</div>; }
