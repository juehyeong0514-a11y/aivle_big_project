import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, candidateAuthHeaders } from '../api/client';
import { CodingExamWorkspace } from '../components/CodingExamWorkspace';
import { getLiveMediaStatus, hasActiveLiveStream, stopLiveMonitoring } from '../applicant/liveMonitoring';

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
  const codingQuestions = useMemo(() => questions.filter((question) => question.type === 'CODING'), [questions]);

  useEffect(() => {
    if (!hasActiveLiveStream('webcam') || !hasActiveLiveStream('screen')) navigate('/exam/check', { replace: true });
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
      .then(({ data }) => {
        const normalized = Array.isArray(data.questions)
          ? data.questions.map((question) => ({ ...question, options: Array.isArray(question.options) ? question.options.filter(Boolean) : [] }))
          : [];
        setExam(data.exam ?? null);
        setQuestions(normalized);
        return api.get('/applicant/exam/progress', { headers: candidateAuthHeaders() });
      })
      .then((response) => {
        if (!response) return;
        setAnswers(response.data.answers ?? {});
        setRunResults(response.data.runResults ?? {});
        if (response.data.updatedAt) setSaveStatus('저장됨 · ' + new Date(response.data.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
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

  if (submitted) return <ResultPage submitted={submitted} navigate={navigate} />;
  if (error) return <ErrorPage error={error} navigate={navigate} />;
  if (!exam) return <main className="container"><div className="workspace-loading">시험 세션을 불러오는 중입니다...</div></main>;
  if (codingQuestions.length) return <form onSubmit={submitExam}><CodingExamWorkspace answers={answers} exam={exam} questions={codingQuestions} runResults={runResults} saveProgress={saveCodingProgress} saveStatus={saveStatus} submissionError={submissionError} updateAnswers={setAnswers} updateRunResults={setRunResults} /></form>;

  return (
    <main className="container exam-session-page">
      <div className="workspace-heading"><div><span className="workspace-eyebrow">EXAM SESSION</span><h1>{exam.title}</h1><p>답안을 제출하면 시험이 종료됩니다. 제출 전 답안을 확인해 주세요.</p></div><div className="workspace-role-mark manager"><Clock size={18} /> {exam.duration}</div></div>
      <form onSubmit={submitExam}>
        {submissionError && <div className="workspace-alert error">{submissionError}</div>}
        <div className="exam-question-list">
          {questions.map((question, index) => <fieldset className="data-panel exam-question-card" key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.length ? question.options.map((option) => <label className="exam-option" key={option}><input checked={answers[question.id] === option} name={question.id} type="radio" value={option} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />{option}</label>) : <p className="empty-state">이 문제의 선택지를 확인할 수 없습니다.</p>}</fieldset>)}
          {!questions.length && <div className="data-panel empty-state">아직 등록된 문제가 없습니다. 관리자에게 문의해 주세요.</div>}
        </div>
        <button className="btn-primary" disabled={!questions.length} type="submit"><Send size={17} /> 시험 제출</button>
      </form>
    </main>
  );
}

function ResultPage({ submitted, navigate }) {
  const awaitingReview = submitted.gradingStatus === 'PENDING_REVIEW';
  return <main className="container"><div className="card exam-session-result"><CheckCircle2 size={34} color="#16a34a" /><h1>시험 제출 완료</h1><p>{awaitingReview ? '작성 코드와 실행 결과가 저장되었습니다. 운영자 검토 후 결과가 확정됩니다.' : `${submitted.totalCount}문제 중 ${submitted.correctCount}문제를 맞혔습니다.`}</p>{!awaitingReview && <strong>점수 {submitted.score}점</strong>}<button className="btn-primary" onClick={() => navigate('/')}>처음으로 돌아가기</button></div></main>;
}

function ErrorPage({ error, navigate }) {
  return <main className="container"><div className="workspace-alert error">{error}</div><button className="btn-primary" onClick={() => navigate('/')}>처음으로 돌아가기</button></main>;
}
