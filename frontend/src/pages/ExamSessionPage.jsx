import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, candidateAuthHeaders } from '../api/client';

export default function ExamSessionPage() {
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/applicant/exam', { headers: candidateAuthHeaders() })
      .then(({ data }) => { setExam(data.exam); setQuestions(data.questions); })
      .catch((reason) => { setError(apiErrorMessage(reason, '시험 세션을 확인할 수 없습니다. 초대 링크로 다시 입장해주세요.')); });
  }, []);

  const submitExam = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/applicant/exam/submit', { answers }, { headers: candidateAuthHeaders() });
      setSubmitted(data);
      localStorage.removeItem('candidateAccessToken');
    } catch (reason) {
      setError(apiErrorMessage(reason, '답안을 제출하지 못했습니다.'));
    }
  };

  if (submitted) return <main className="container"><div className="card exam-session-result"><CheckCircle2 size={34} color="#16a34a" /><h1>시험 제출 완료</h1><p>{submitted.totalCount}문제 중 {submitted.correctCount}문제를 맞혔습니다.</p><strong>점수 {submitted.score}점</strong><button className="btn-primary" onClick={() => navigate('/')}>홈으로 돌아가기</button></div></main>;
  if (error) return <main className="container"><div className="workspace-alert error">{error}</div><button className="btn-primary" onClick={() => navigate('/')}>홈으로 돌아가기</button></main>;
  if (!exam) return <main className="container"><div className="workspace-loading">시험 세션을 불러오는 중입니다...</div></main>;

  return (
    <main className="container exam-session-page">
      <div className="workspace-heading"><div><span className="workspace-eyebrow">EXAM SESSION</span><h1>{exam.title}</h1><p>답안을 제출하면 시험이 종료됩니다. 제출 전 답안을 확인해주세요.</p></div><div className="workspace-role-mark manager"><Clock size={18} /> {exam.duration}</div></div>
      <form onSubmit={submitExam}>
        <div className="exam-question-list">{questions.map((question, index) => <fieldset className="data-panel exam-question-card" key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option) => <label key={option} className="exam-option"><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />{option}</label>)}</fieldset>)}{!questions.length && <div className="data-panel empty-state">아직 등록된 문제가 없습니다. 관리자에게 문의해주세요.</div>}</div>
        <button className="btn-primary" type="submit" disabled={!questions.length}><Send size={17} /> 시험 제출</button>
      </form>
    </main>
  );
}
