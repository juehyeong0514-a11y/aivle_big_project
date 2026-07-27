import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, CheckSquare, Copy, Mail, Send, Trash2, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function ManagerExamDetailPage() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [assignedCandidateIds, setAssignedCandidateIds] = useState([]);
  const [questionForm, setQuestionForm] = useState({ prompt: '', options: '', answer: '' });
  const [candidateForm, setCandidateForm] = useState({ name: '', email: '' });
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [mailPreviews, setMailPreviews] = useState([]);
  const [copiedEntryLink, setCopiedEntryLink] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const headers = { headers: authHeaders() };

  const load = async () => {
    const [examResponse, candidateResponse, questionResponse, resultResponse] = await Promise.all([
      api.get('/manager/exams', headers),
      api.get('/manager/candidates', headers),
      api.get(`/manager/exams/${examId}/questions`, headers),
      api.get(`/manager/results?examId=${encodeURIComponent(examId)}`, headers),
    ]);
    setExam(examResponse.data.find((item) => item.id === examId) || null);
    setCandidates(candidateResponse.data);
    setQuestions(questionResponse.data);
    setAssignedCandidateIds(resultResponse.data.map((item) => item.candidateId));
    setSelectedCandidateIds((current) => current.filter((candidateId) => candidateResponse.data.some((candidate) => candidate.id === candidateId)));
  };

  useEffect(() => {
    load().catch((reason) => setError(apiErrorMessage(reason, '시험 상세 정보를 불러오지 못했습니다.')));
  }, [examId]);

  const scopedCandidates = useMemo(() => candidates.filter((candidate) => candidate.organizationId === exam?.organizationId), [candidates, exam]);
  const allCandidatesSelected = scopedCandidates.length > 0 && scopedCandidates.every((candidate) => selectedCandidateIds.includes(candidate.id));
  const selectedAssignedCount = selectedCandidateIds.filter((candidateId) => assignedCandidateIds.includes(candidateId)).length;

  const createQuestion = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/manager/exams/${examId}/questions`, {
        prompt: questionForm.prompt,
        options: questionForm.options.split('\n').map((option) => option.trim()).filter(Boolean),
        answer: questionForm.answer,
      }, headers);
      setQuestionForm({ prompt: '', options: '', answer: '' });
      setMessage('문제가 등록되었습니다.');
      await load();
    } catch (reason) {
      setMessage(apiErrorMessage(reason, '문제 등록에 실패했습니다.'));
    }
  };

  const createCandidate = async (event) => {
    event.preventDefault();
    try {
      await api.post('/manager/candidates', { ...candidateForm, organizationId: exam.organizationId }, headers);
      setCandidateForm({ name: '', email: '' });
      setMessage('응시자가 등록되었습니다.');
      await load();
    } catch (reason) {
      setMessage(apiErrorMessage(reason, '응시자 등록에 실패했습니다.'));
    }
  };

  const toggleCandidate = (id) => setSelectedCandidateIds((current) => current.includes(id)
    ? current.filter((candidateId) => candidateId !== id)
    : [...current, id]);

  const toggleAllCandidates = () => setSelectedCandidateIds(allCandidatesSelected ? [] : scopedCandidates.map((candidate) => candidate.id));

  const sendInvitations = async () => {
    try {
      await api.post(`/manager/exams/${examId}/assign`, { candidateIds: selectedCandidateIds }, headers);
      const { data } = await api.post(`/manager/exams/${examId}/invitations/send`, { candidateIds: selectedCandidateIds }, headers);
      setMailPreviews(data.mailPreviews ?? []);
      setCopiedEntryLink('');
      setMessage(data.deliveryStatus === 'SENT'
        ? `${data.count}명에게 초대 메일을 전송했습니다.`
        : `${data.count}명 초대 정보가 생성되었습니다. 메일 서버 연결 전이라 미리보기 상태입니다.`);
      await load();
    } catch (reason) {
      setMessage(apiErrorMessage(reason, '대상자 배정 또는 초대에 실패했습니다.'));
    }
  };

  const copyEntryLink = async (entryLink) => {
    try {
      await navigator.clipboard.writeText(entryLink);
    } catch {
      const copyTarget = document.createElement('textarea');
      copyTarget.value = entryLink;
      copyTarget.setAttribute('readonly', '');
      copyTarget.style.position = 'fixed';
      copyTarget.style.opacity = '0';
      document.body.append(copyTarget);
      copyTarget.select();
      const copied = document.execCommand('copy');
      copyTarget.remove();
      if (!copied) {
        setMessage('초대 링크를 복사하지 못했습니다. 아래 링크를 직접 선택해 복사해주세요.');
        return;
      }
    }
    setCopiedEntryLink(entryLink);
    setMessage('초대 링크를 클립보드에 복사했습니다.');
  };

  const removeAssignments = async () => {
    const candidateIds = selectedCandidateIds.filter((candidateId) => assignedCandidateIds.includes(candidateId));
    if (!candidateIds.length) {
      setMessage('배정된 대상자를 먼저 선택해주세요.');
      return;
    }
    try {
      const { data } = await api.delete(`/manager/exams/${examId}/assignments`, { ...headers, data: { candidateIds } });
      setSelectedCandidateIds([]);
      setMessage(`${data.removedCount}명의 시험 대상자 배정을 해제했습니다. 응시자 등록 정보는 유지됩니다.`);
      await load();
    } catch (reason) {
      setMessage(apiErrorMessage(reason, '시험 대상자 배정을 해제하지 못했습니다.'));
    }
  };

  if (error) return <section className="workspace-shell"><div className="workspace-alert error">{error}</div><button className="secondary-button" type="button" onClick={() => navigate('/manager/exams')}>시험 목록으로</button></section>;
  if (!exam) return <section className="workspace-shell"><div className="workspace-loading">시험 상세 정보를 불러오는 중입니다...</div></section>;

  return (
    <section className="workspace-shell">
      <button className="back-link" type="button" onClick={() => navigate('/manager/exams')}><ArrowLeft size={16} /> 시험 목록으로</button>
      <div className="workspace-heading"><div><span className="workspace-eyebrow">EXAM DETAIL</span><h1>{exam.title}</h1><p>{exam.date} · {exam.duration} · {exam.questions}</p></div><span className="status-badge approved">{exam.status}</span></div>
      {message && <div className="workspace-alert">{message}</div>}
      <div className="exam-detail-summary"><strong>시험 운영 메뉴</strong><span>문제 {questions.length}개 · 응시자 {scopedCandidates.length}명</span></div>

      <div className="workspace-grid two-columns">
        <form className="data-panel form-panel" onSubmit={createQuestion}>
          <div className="panel-heading"><div><h2>문제 관리</h2><p>선택지와 정답을 입력합니다.</p></div><BookOpen size={20} /></div>
          <label>문제 내용<textarea value={questionForm.prompt} onChange={(event) => setQuestionForm({ ...questionForm, prompt: event.target.value })} rows="3" required /></label>
          <label>선택지 <span className="text-muted">(한 줄에 하나씩)</span><textarea value={questionForm.options} onChange={(event) => setQuestionForm({ ...questionForm, options: event.target.value })} rows="4" required /></label>
          <label>정답<input value={questionForm.answer} onChange={(event) => setQuestionForm({ ...questionForm, answer: event.target.value })} required /></label>
          <button className="primary-button" type="submit"><BookOpen size={16} /> 문제 등록</button>
          <div className="question-list">{questions.map((question, index) => <div className="question-list-row" key={question.id}><strong>{index + 1}. {question.prompt}</strong><span>{question.options.join(' · ')}</span></div>)}</div>
        </form>

        <form className="data-panel form-panel" onSubmit={createCandidate}>
          <div className="panel-heading"><div><h2>응시자 이메일 등록</h2><p>이 시험의 조직에 응시자를 추가합니다.</p></div><Users size={20} /></div>
          <label>응시자 이름<input value={candidateForm.name} onChange={(event) => setCandidateForm({ ...candidateForm, name: event.target.value })} required /></label>
          <label>응시자 이메일<input type="email" value={candidateForm.email} onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })} required /></label>
          <button className="primary-button" type="submit"><Users size={16} /> 응시자 등록</button>
        </form>
      </div>

      <div className="data-panel">
        <div className="panel-heading"><div><h2>시험 대상자 배정 및 초대</h2><p>전체 선택으로 일괄 배정·초대하거나 선택한 대상자의 배정을 해제할 수 있습니다.</p></div><Send size={20} /></div>
        <div className="candidate-toolbar">
          <label className="select-all-control"><input type="checkbox" checked={allCandidatesSelected} onChange={toggleAllCandidates} disabled={!scopedCandidates.length} /><span>전체 선택</span></label>
          <span>{selectedCandidateIds.length}명 선택 · {selectedAssignedCount}명 배정됨</span>
        </div>
        <div className="candidate-check-list">{scopedCandidates.map((candidate) => <label key={candidate.id}><input type="checkbox" checked={selectedCandidateIds.includes(candidate.id)} onChange={() => toggleCandidate(candidate.id)} /><span>{candidate.name}<small>{candidate.email} · {candidate.candidateNumber}</small></span>{assignedCandidateIds.includes(candidate.id) && <em className="assignment-state">배정됨</em>}</label>)}{!scopedCandidates.length && <p className="empty-state">응시자 이메일을 먼저 등록해주세요.</p>}</div>
        <div className="candidate-action-row">
          <button className="primary-button" type="button" disabled={!selectedCandidateIds.length} onClick={sendInvitations}><Mail size={16} /> 선택 대상자 배정 및 초대</button>
          <button className="danger-button" type="button" disabled={!selectedAssignedCount} onClick={removeAssignments}><Trash2 size={16} /> 선택 대상자 배정 해제</button>
          <span className="action-hint"><CheckSquare size={14} /> 배정 해제해도 응시자 등록 정보는 삭제되지 않습니다.</span>
        </div>
        {mailPreviews.length > 0 && <div className="mail-preview">
          <strong>방금 생성한 초대 링크</strong>
          <p className="form-hint">테스트용 링크입니다. 링크를 복사해 새 시크릿 창에서 응시자 입장 화면을 확인할 수 있습니다.</p>
          {mailPreviews.map((preview) => <div className="mail-preview-row" key={preview.entryLink}>
            <div>
              <strong>{preview.to}</strong>
              <span>{preview.examName}</span>
              <span className="invite-candidate-number"><b>응시번호</b><code>{preview.candidateNumber}</code></span>
              <code>{preview.entryLink}</code>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={() => copyEntryLink(preview.entryLink)}>
              {copiedEntryLink === preview.entryLink ? <Check size={16} /> : <Copy size={16} />}
              {copiedEntryLink === preview.entryLink ? '복사됨' : '링크 복사'}
            </button>
          </div>)}
        </div>}
      </div>
    </section>
  );
}
