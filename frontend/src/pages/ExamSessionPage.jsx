import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Send, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, candidateAuthHeaders } from '../api/client';
import { CodingExamWorkspace } from '../components/CodingExamWorkspace';
import { getLiveMediaStatus, hasActiveLiveStream, stopLiveMonitoring } from '../applicant/liveMonitoring';

const durationInSeconds = (duration) => {
  const minutes = Number.parseInt(String(duration ?? '').match(/\d+/)?.[0] ?? '', 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 0;
};

const formatRemainingTime = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours > 0
    ? [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':')
    : [minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
};

export default function ExamSessionPage() {
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [runResults, setRunResults] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [activeWarning, setActiveWarning] = useState(null);
  const [termination, setTermination] = useState(null);
  const warningIdsRef = useRef(new Set());
  const warningsInitializedRef = useRef(false);
  const codingQuestions = useMemo(() => questions.filter((question) => question.type === 'CODING'), [questions]);

  useEffect(() => {
    const skipPrecheck = localStorage.getItem('candidateSkipPrecheck') === 'true';
    if (skipPrecheck || (hasActiveLiveStream('webcam') && hasActiveLiveStream('screen'))) return;
    api.get('/applicant/termination', { headers: candidateAuthHeaders(), params: { poll: Date.now() } })
      .then(({ data }) => {
        if (data.termination) {
          stopLiveMonitoring();
          setTermination(data.termination);
          return;
        }
        navigate('/exam/check', { replace: true });
      })
      .catch(() => navigate('/exam/check', { replace: true }));
  }, [navigate]);

  useEffect(() => {
    const disconnectMonitoring = () => {
      stopLiveMonitoring();
      const token = localStorage.getItem('candidateAccessToken');
      if (!token) return;
      const baseUrl = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
      const disconnectUrl = baseUrl + '/applicant/media-disconnect';
      navigator.sendBeacon?.(disconnectUrl, new URLSearchParams({ accessToken: token }));
      void fetch(disconnectUrl, {
        method: 'POST',
        body: new URLSearchParams({ accessToken: token }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', disconnectMonitoring);
    return () => window.removeEventListener('pagehide', disconnectMonitoring);
  }, []);

  useEffect(() => {
    let active = true;
    const checkTermination = () => api.get('/applicant/termination', { headers: candidateAuthHeaders(), params: { poll: Date.now() } })
      .then(({ data }) => {
        if (!active || !data.termination) return;
        stopLiveMonitoring();
        setTermination(data.termination);
      })
      .catch(() => {});
    checkTermination();
    const timer = window.setInterval(checkTermination, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadWarnings = async () => {
      try {
        const { data } = await api.get('/applicant/warnings', { headers: candidateAuthHeaders(), params: { poll: Date.now() } });
        if (!isMounted || !Array.isArray(data)) return;
        const warningIds = new Set(data.map((warning) => warning.id));
        if (!warningsInitializedRef.current) {
          warningIdsRef.current = warningIds;
          warningsInitializedRef.current = true;
          return;
        }
        const newWarning = data.find((warning) => !warningIdsRef.current.has(warning.id));
        warningIdsRef.current = warningIds;
        if (newWarning) setActiveWarning(newWarning);
      } catch {
        // Warning delivery is best-effort and should not interrupt the exam session.
      }
    };
    loadWarnings();
    const timer = window.setInterval(loadWarnings, 3000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!exam?.id) return undefined;
    const totalSeconds = durationInSeconds(exam.duration);
    if (!totalSeconds) return undefined;
    const timerKey = `examEndAt:${exam.id}`;
    const savedEndAt = Number(sessionStorage.getItem(timerKey));
    const endAt = Number.isFinite(savedEndAt) && savedEndAt > Date.now() ? savedEndAt : Date.now() + totalSeconds * 1000;
    sessionStorage.setItem(timerKey, String(endAt));
    const updateTimer = () => setRemainingSeconds(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [exam?.id, exam?.duration]);

  useEffect(() => {
    const reportMediaHeartbeat = () => {
      void api.put('/applicant/media-status', { media: getLiveMediaStatus() }, { headers: candidateAuthHeaders() }).catch(() => {});
    };
    reportMediaHeartbeat();
    const timer = window.setInterval(reportMediaHeartbeat, 10_000);
    document.addEventListener('visibilitychange', reportMediaHeartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reportMediaHeartbeat);
    };
  }, []);

  useEffect(() => {
    api.get('/applicant/exam', { headers: candidateAuthHeaders() })
      .then(async ({ data }) => {
        const normalized = Array.isArray(data.questions)
          ? data.questions.map((question) => ({ ...question, options: Array.isArray(question.options) ? question.options.filter(Boolean) : [] }))
          : [];
        setExam(data.exam ?? null);
        setQuestions(normalized);
        const progress = await api.get('/applicant/exam/progress', { headers: candidateAuthHeaders() });
        return { progress, questions: normalized };
      })
      .then(({ progress, questions: loadedQuestions }) => {
        const initializedAnswers = { ...(progress.data.answers ?? {}) };
        loadedQuestions.forEach((question) => {
          if (question.type !== 'CODING' || !question.starterCode) return;
          const savedAnswer = initializedAnswers[question.id];
          if (!savedAnswer || !savedAnswer.source?.trim()) {
            initializedAnswers[question.id] = {
              ...savedAnswer,
              language: savedAnswer?.language ?? question.languages?.[0] ?? 'JavaScript',
              source: question.starterCode,
            };
          }
        });
        setAnswers(initializedAnswers);
        setRunResults(progress.data.runResults ?? {});
        if (progress.data.updatedAt) setSaveStatus('저장됨 · ' + new Date(progress.data.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch((reason) => setError(apiErrorMessage(reason, '시험 세션을 확인할 수 없습니다. 초대 링크로 다시 입장해 주세요.')));
  }, []);

  const submitExam = async (event) => {
    event.preventDefault();
    setSubmissionError('');
    try {
      const { data } = await api.post('/applicant/exam/submit', { answers, runResults }, { headers: candidateAuthHeaders() });
      stopLiveMonitoring();
      setSubmitted(data);
      localStorage.removeItem('candidateAccessToken');
      localStorage.removeItem('candidateSkipPrecheck');
      sessionStorage.removeItem('candidateInvitationToken');
      sessionStorage.removeItem('candidateInvitationName');
    } catch (reason) {
      setSubmissionError(apiErrorMessage(reason, '답안을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
  };

  const saveCodingProgress = async () => {
    setSaveStatus('저장 중...');
    try {
      const { data } = await api.put('/applicant/exam/progress', { answers, runResults }, { headers: candidateAuthHeaders() });
      setSaveStatus('저장됨 · ' + new Date(data.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    } catch (reason) {
      setSaveStatus(apiErrorMessage(reason, '코드 저장에 실패했습니다.'));
    }
  };

  if (termination) return <ForceTerminatedPage termination={termination} />;
  if (submitted) return <ResultPage submitted={submitted} navigate={navigate} />;
  if (error) return <ErrorPage error={error} navigate={navigate} />;
  if (!exam) return <main className="container"><div className="workspace-loading">시험 세션을 불러오는 중입니다...</div></main>;
  const remainingTime = formatRemainingTime(remainingSeconds);
  if (codingQuestions.length) return <form onSubmit={submitExam}><CodingExamWorkspace answers={answers} exam={exam} questions={questions} remainingTime={remainingTime} runResults={runResults} saveProgress={saveCodingProgress} saveStatus={saveStatus} submissionError={submissionError} updateAnswers={setAnswers} updateRunResults={setRunResults} />{activeWarning && <ExamWarningModal warning={activeWarning} dismiss={() => setActiveWarning(null)} />}</form>;

  return (
    <main className="container exam-session-page">
      <div className="workspace-heading"><div><span className="workspace-eyebrow">EXAM SESSION</span><h1>{exam.title}</h1><p>답안을 제출하면 시험이 종료됩니다. 제출 전 답안을 확인해 주세요.</p></div><div className="workspace-role-mark manager"><Clock size={18} /> {remainingTime}</div></div>
      <form onSubmit={submitExam}>
        {submissionError && <div className="workspace-alert error">{submissionError}</div>}
        <div className="exam-question-list">
          {questions.map((question, index) => <fieldset className="data-panel exam-question-card" key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.length ? question.options.map((option) => <label className="exam-option" key={option}><input checked={answers[question.id] === option} name={question.id} type="radio" value={option} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />{option}</label>) : <p className="empty-state">이 문제의 선택지를 확인할 수 없습니다.</p>}</fieldset>)}
          {!questions.length && <div className="data-panel empty-state">아직 등록된 문제가 없습니다. 관리자에게 문의해 주세요.</div>}
        </div>
        <button className="btn-primary" disabled={!questions.length} type="submit"><Send size={17} /> 시험 제출</button>
      </form>
      {activeWarning && <ExamWarningModal warning={activeWarning} dismiss={() => setActiveWarning(null)} />}
    </main>
  );
}

function ExamWarningModal({ warning, dismiss }) {
  const isAiWarning = warning.source === 'AI';
  return <div className="exam-warning-modal" role="dialog" aria-modal="true" aria-labelledby="exam-warning-title">
    <button className="exam-warning-backdrop" type="button" aria-label="경고 메시지 닫기" onClick={dismiss} />
    <section className="exam-warning-panel">
      <div className="exam-warning-heading"><AlertTriangle size={22} aria-hidden="true" /><span id="exam-warning-title">{isAiWarning ? 'AI 모니터링 알림' : '감독자 메시지'}</span></div>
      <p>{warning.message}</p>
      {isAiWarning && <p className="exam-warning-guidance">주변 환경을 정리하고 시험 화면을 계속 진행해 주세요. 최종 판단은 감독자가 검토합니다.</p>}
      <button className="btn-primary" type="button" onClick={dismiss}>확인</button>
    </section>
  </div>;
}

function ResultPage({ submitted, navigate }) {
  const awaitingReview = submitted.gradingStatus === 'PENDING_REVIEW';
  return <main className="container"><div className="card exam-session-result"><CheckCircle2 size={34} color="#16a34a" /><h1>시험 제출 완료</h1><p>{awaitingReview ? '작성 코드와 실행 결과가 저장되었습니다. 운영자 검토 후 결과가 확정됩니다.' : `${submitted.totalCount}문제 중 ${submitted.correctCount}문제를 맞혔습니다.`}</p>{!awaitingReview && <strong>점수 {submitted.score}점</strong>}<button className="btn-primary" onClick={() => navigate('/')}>처음으로 돌아가기</button></div></main>;
}

function ForceTerminatedPage({ termination }) {
  return <main className="container"><div className="card exam-session-result force-terminated-result"><ShieldX size={42} color="var(--status-error)" /><h1>시험이 강제 종료되었습니다</h1><p>감독자에 의해 시험이 종료되어 더 이상 응시할 수 없습니다.</p><p>관련 문의는 시험 담당자에게 해주세요.</p><dl><div><dt>처리 결과</dt><dd>탈락</dd></div><div><dt>종료 시각</dt><dd>{termination.terminatedAt ? new Date(termination.terminatedAt).toLocaleString('ko-KR') : '-'}</dd></div></dl></div></main>;
}

function ErrorPage({ error, navigate }) {
  return <main className="container"><div className="workspace-alert error">{error}</div><button className="btn-primary" onClick={() => navigate('/')}>처음으로 돌아가기</button></main>;
}
