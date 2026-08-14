import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Play, RefreshCw, Send, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, candidateAuthHeaders } from '../api/client';
import { CodingExamWorkspace } from '../components/CodingExamWorkspace';
import { shouldRequestExamStartBypass } from '../applicant/examStartBypass.mjs';
import { getLiveMediaStatus, hasActiveLiveStream, stopLiveMonitoring } from '../applicant/liveMonitoring';
import useTestShortcuts from '../applicant/useTestShortcuts';

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
  const [submissionError, setSubmissionError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [waitingUntil, setWaitingUntil] = useState('');
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const [showWaitingRoom, setShowWaitingRoom] = useState(true);
  const [startAvailable, setStartAvailable] = useState(false);
  const [checkingStart, setCheckingStart] = useState(false);
  const [enteringExam, setEnteringExam] = useState(false);
  const [waitingError, setWaitingError] = useState('');
  const [activeWarning, setActiveWarning] = useState(null);
  const [termination, setTermination] = useState(null);
  const warningIdsRef = useRef(new Set());
  const warningsInitializedRef = useRef(false);
  const bypassRequestedRef = useRef(false);
  const checkingStartRef = useRef(false);
  const testShortcutsEnabled = useTestShortcuts();
  const codingQuestions = useMemo(() => questions.filter((question) => question.type === 'CODING'), [questions]);

  useEffect(() => {
    const skipPrecheck = localStorage.getItem('candidateSkipPrecheck') === 'true'
      || (import.meta.env.DEV && sessionStorage.getItem('candidateDevSkipPrecheck') === 'true');
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
    if (!exam?.id || showWaitingRoom) return undefined;
    const endAt = Date.parse(exam.endsAt ?? '');
    if (!Number.isFinite(endAt)) return undefined;
    const updateTimer = () => setRemainingSeconds(Math.max(0, Math.ceil((endAt - (Date.now() + serverClockOffsetMs)) / 1000)));
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [exam?.endsAt, exam?.id, serverClockOffsetMs, showWaitingRoom]);

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

  const syncWaitingStatus = useCallback((data) => {
    setExam(data.exam ?? null);
    setTermination(data.termination ?? null);
    setWaitingUntil(data.startsAt ?? '');
    const serverNow = Date.parse(data.serverNow ?? '');
    if (Number.isFinite(serverNow)) setServerClockOffsetMs(serverNow - Date.now());
    setStartAvailable(!data.waiting);
  }, []);

  const initializeExam = useCallback(async (data) => {
    const normalized = Array.isArray(data.questions)
      ? data.questions.map((question) => ({ ...question, options: Array.isArray(question.options) ? question.options.filter(Boolean) : [] }))
      : [];
    setExam(data.exam ?? null);
    setQuestions(normalized);
    const progress = await api.get('/applicant/exam/progress', { headers: candidateAuthHeaders() });
    const initializedAnswers = { ...(progress.data.answers ?? {}) };
    normalized.forEach((question) => {
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
    setWaitingUntil('');
    setShowWaitingRoom(false);
  }, []);

  const enterExam = useCallback(async ({ bypass = false } = {}) => {
    if (enteringExam || (!startAvailable && !bypass)) return;
    setEnteringExam(true);
    setWaitingError('');
    try {
      if (bypass) await api.post('/applicant/exam/test-start-bypass', {}, { headers: candidateAuthHeaders() });
      const { data } = await api.get('/applicant/exam', { headers: candidateAuthHeaders() });
      syncWaitingStatus(data);
      if (data.termination) return;
      if (data.waiting) {
        setWaitingError('서버 기준 시험 시작 전입니다. 시간을 다시 확인해 주세요.');
        return;
      }
      await initializeExam(data);
    } catch (reason) {
      setWaitingError(apiErrorMessage(reason, '시험 입장을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setEnteringExam(false);
    }
  }, [enteringExam, initializeExam, startAvailable, syncWaitingStatus]);

  const refreshStartStatus = useCallback(async () => {
    if (checkingStartRef.current) return;
    checkingStartRef.current = true;
    setCheckingStart(true);
    setWaitingError('');
    try {
      const { data } = await api.get('/applicant/exam', { headers: candidateAuthHeaders(), params: { statusOnly: 1, poll: Date.now() } });
      syncWaitingStatus(data);
    } catch (reason) {
      setWaitingError(apiErrorMessage(reason, '서버 시간을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      checkingStartRef.current = false;
      setCheckingStart(false);
    }
  }, [syncWaitingStatus]);

  useEffect(() => {
    refreshStartStatus();
  }, [refreshStartStatus]);

  useEffect(() => {
    if (!waitingUntil) return undefined;
    const updateWaitingTime = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(waitingUntil) - (Date.now() + serverClockOffsetMs)) / 1000));
      setWaitingSeconds(seconds);
      if (seconds === 0) setStartAvailable(true);
    };
    updateWaitingTime();
    const timer = window.setInterval(updateWaitingTime, 1000);
    return () => window.clearInterval(timer);
  }, [serverClockOffsetMs, waitingUntil]);

  useEffect(() => {
    if (!testShortcutsEnabled) {
      bypassRequestedRef.current = false;
      return;
    }
    if (!shouldRequestExamStartBypass({ shortcutEnabled: testShortcutsEnabled, waitingRoomVisible: showWaitingRoom, requestSent: bypassRequestedRef.current })) return;
    bypassRequestedRef.current = true;
    void enterExam({ bypass: true });
  }, [enterExam, showWaitingRoom, testShortcutsEnabled]);

  const submitExam = async (event) => {
    event.preventDefault();
    setSubmissionError('');
    try {
      const { data } = await api.post('/applicant/exam/submit', { answers, runResults }, { headers: candidateAuthHeaders() });
      stopLiveMonitoring();
      setSubmitted(data);
      localStorage.removeItem('candidateAccessToken');
      localStorage.removeItem('candidateSkipPrecheck');
      sessionStorage.removeItem('candidateDevSkipPrecheck');
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
  if (!exam && waitingError) return <ErrorPage error={waitingError} navigate={navigate} />;
  if (!exam) return <main className="container"><div className="workspace-loading">시험 세션을 불러오는 중입니다...</div></main>;
  if (showWaitingRoom) return <ExamWaitingPage checkingStart={checkingStart} enteringExam={enteringExam} exam={exam} onEnter={enterExam} onRefresh={refreshStartStatus} startAvailable={startAvailable} startsAt={waitingUntil} waitingError={waitingError} waitingSeconds={waitingSeconds} />;
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

function ExamWaitingPage({ checkingStart, enteringExam, exam, onEnter, onRefresh, startAvailable, startsAt, waitingError, waitingSeconds }) {
  return <main className="container exam-waiting-page"><section className="card exam-session-result exam-waiting-card">
    <header className="exam-waiting-intro">
      <div className={`exam-waiting-status-icon${startAvailable ? ' ready' : ''}`}><CheckCircle2 size={22} aria-hidden="true" /></div>
      <span className="workspace-eyebrow">환경 점검 완료</span>
      <h1>{exam.title}</h1>
      <p>{startAvailable ? '입장할 수 있습니다. 아래 버튼을 눌러 시작해 주세요.' : '시험 시작 시간까지 기다려 주세요.'}</p>
    </header>
    <div className="exam-waiting-timer" aria-live="polite">
      <span>{startAvailable ? '시험 입장 가능' : '시험 시작까지'}</span>
      <strong className="exam-waiting-countdown">{startAvailable ? '입장 가능' : formatRemainingTime(waitingSeconds)}</strong>
    </div>
    <dl><div><dt>시험 시작</dt><dd>{startsAt ? new Date(startsAt).toLocaleString('ko-KR') : '즉시 입장 가능'}</dd></div><div><dt>제한 시간</dt><dd>{exam.duration}</dd></div></dl>
    {waitingError && <div className="workspace-alert error exam-waiting-error" role="alert">{waitingError}</div>}
    <div className="exam-waiting-actions">
      <button className="secondary-button" type="button" onClick={onRefresh} disabled={checkingStart || enteringExam}><RefreshCw size={17} aria-hidden="true" /> {checkingStart ? '확인 중...' : '시간 다시 확인'}</button>
      <button className="primary-button exam-start-button" type="button" onClick={() => onEnter()} disabled={!startAvailable || enteringExam}><Play size={17} aria-hidden="true" /> {enteringExam ? '입장 중...' : startAvailable ? '코딩테스트 시작' : '시작 시간 전입니다'}</button>
    </div>
    <p className="form-hint exam-waiting-hint">서버 시간 기준입니다. 시작 시간이 되면 입장 버튼이 활성화됩니다.</p>
  </section></main>;
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
