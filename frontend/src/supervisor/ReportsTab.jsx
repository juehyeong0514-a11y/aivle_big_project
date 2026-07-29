import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Building2, FileText, Save, TerminalSquare, UserRound } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const reviewStatusLabels = { NOT_REVIEWED: '미검토', NORMAL: '정상', REVIEW_REQUIRED: '재검토 필요', SUSPICIOUS: '부정행위 의심' };

export default function ReportsTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [results, setResults] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [detail, setDetail] = useState(null);
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [review, setReview] = useState({ reviewStatus: 'NOT_REVIEWED', reviewNote: '' });
  const [savingReview, setSavingReview] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/manager/organizations', { headers: authHeaders() })
      .then(({ data }) => {
        const managedOrganizations = data.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
        setOrganizations(managedOrganizations);
        setOrganizationId((current) => managedOrganizations.some((organization) => organization.id === current) ? current : managedOrganizations[0]?.id || '');
      })
      .catch((reason) => setError(apiErrorMessage(reason, '결과를 조회할 조직 목록을 불러오지 못했습니다.')));
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setExams([]);
      setSelectedExamId('');
      return;
    }
    api.get('/supervisor/exams?organizationId=' + encodeURIComponent(organizationId), { headers: authHeaders() })
      .then(({ data }) => {
        setExams(data);
        setSelectedExamId(data[0]?.id || '');
      })
      .catch((reason) => setError(apiErrorMessage(reason, '조직의 시험 목록을 불러오지 못했습니다.')));
  }, [organizationId]);

  useEffect(() => {
    setSelectedCandidateId('');
    setDetail(null);
    if (!selectedExamId || !organizationId) {
      setResults([]);
      return;
    }
    api.get(`/manager/results?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() })
      .then(({ data }) => setResults(data))
      .catch((reason) => setError(apiErrorMessage(reason, '결과를 불러오지 못했습니다.')));
  }, [organizationId, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId || !selectedCandidateId) return;
    setMessage('');
    api.get(`/manager/exams/${encodeURIComponent(selectedExamId)}/results/${encodeURIComponent(selectedCandidateId)}`, { headers: authHeaders() })
      .then(({ data }) => {
        setDetail(data);
        setActiveQuestionId(data.questions[0]?.id || '');
        setReview({ reviewStatus: data.result.reviewStatus, reviewNote: data.result.reviewNote });
      })
      .catch((reason) => setError(apiErrorMessage(reason, '응시자 상세 결과를 불러오지 못했습니다.')));
  }, [selectedExamId, selectedCandidateId]);

  const changeOrganization = (nextOrganizationId) => {
    setError('');
    setMessage('');
    setExams([]);
    setSelectedExamId('');
    setResults([]);
    setOrganizationId(nextOrganizationId);
  };

  const saveReview = async () => {
    if (!detail) return;
    setSavingReview(true);
    setMessage('');
    try {
      const { data } = await api.patch(`/manager/exams/${encodeURIComponent(detail.exam.id)}/results/${encodeURIComponent(detail.candidate.id)}/review`, review, { headers: authHeaders() });
      setDetail((current) => ({ ...current, result: { ...current.result, ...data } }));
      setMessage('검토 상태와 메모를 저장했습니다.');
    } catch (reason) {
      setError(apiErrorMessage(reason, '검토 내용을 저장하지 못했습니다.'));
    } finally {
      setSavingReview(false);
    }
  };

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);
  const activeQuestion = detail?.questions.find((question) => question.id === activeQuestionId);
  const codeAnswer = activeQuestion && detail?.codingSubmission?.answers?.[activeQuestion.id];
  const runResult = activeQuestion && detail?.codingSubmission?.runResults?.[activeQuestion.id];

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">RESULT MANAGEMENT</span><h1>응시자 결과 관리</h1><p>응시자 이름을 선택하면 제출 코드, 실행 결과, 감독 경고와 검토 메모를 확인할 수 있습니다.</p></div>
        <div className="workspace-role-mark manager"><BarChart3 size={20} /> 조직별 결과</div>
      </div>
      {error && <div className="workspace-alert error">{error}</div>}
      {message && <div className="workspace-alert">{message}</div>}
      <div className="data-panel organization-switcher">
        <label><span>결과 조직</span><select value={organizationId} onChange={(event) => changeOrganization(event.target.value)}><option value="">결과를 조회할 조직을 선택하세요</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
        <span className="organization-scope-note"><Building2 size={15} /> {selectedOrganization ? selectedOrganization.name + ' 소속 시험만 표시' : '배정된 승인 조직만 표시됩니다.'}</span>
      </div>
      <div className="data-panel organization-switcher">
        <label><span>조회 시험</span><select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)} disabled={!organizationId}><option value="">시험을 선택하세요</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label>
        <span>{selectedExamId ? `${results.length}명 결과` : '조직과 시험을 선택하세요.'}</span>
      </div>
      <div className="data-panel" style={{ overflowX: 'auto' }}>
        <div className="panel-heading"><div><h2>결과 목록</h2><p>응시자 이름을 누르면 상세 결과를 열 수 있습니다.</p></div><FileText size={20} /></div>
        <table className="status-table"><thead><tr><th>응시자</th><th>이메일</th><th>제출 상태</th><th>점수</th><th>제출 시간</th></tr></thead><tbody>
          {results.map((result) => <tr key={result.id} className={selectedCandidateId === result.candidateId ? 'active-result-row' : ''}><td><button type="button" className="result-candidate-button" onClick={() => setSelectedCandidateId(result.candidateId)}>{result.candidateName}</button></td><td>{result.candidateEmail}</td><td>{result.resultStatus === 'PENDING_REVIEW' ? '검토 대기' : result.status}</td><td>{result.score ?? '-'}</td><td>{result.submittedAt ? new Date(result.submittedAt).toLocaleString('ko-KR') : '-'}</td></tr>)}
        </tbody></table>
        {!organizationId && <p className="empty-state">결과를 조회할 조직을 선택해주세요.</p>}
        {organizationId && !selectedExamId && <p className="empty-state">결과를 조회할 시험을 선택해주세요.</p>}
        {selectedExamId && !results.length && <p className="empty-state">선택한 시험의 결과가 없습니다.</p>}
      </div>
      {detail && <section className="data-panel result-detail-panel">
        <div className="panel-heading"><div><h2><UserRound size={19} /> {detail.candidate.name} 응시자 상세 결과</h2><p>{detail.candidate.candidateNumber} · {detail.candidate.email}</p></div><span className="status-badge approved">{reviewStatusLabels[detail.result.reviewStatus]}</span></div>
        <div className="result-summary-grid">
          <ResultMetric label="제출 상태" value={detail.result.resultStatus === 'PENDING_REVIEW' ? '검토 대기' : detail.result.status} />
          <ResultMetric label="점수" value={detail.result.score ?? '채점 대기'} />
          <ResultMetric label="제출 시간" value={detail.result.submittedAt ? new Date(detail.result.submittedAt).toLocaleString('ko-KR') : '미제출'} />
          <ResultMetric label="감독 경고" value={`${detail.warnings.length}건`} />
        </div>
        <div className="result-detail-grid">
          <section className="result-code-section">
            <div className="section-title-row"><div><h3>문제별 작성 코드</h3><p>채점 서버 연결 전에는 브라우저 실행 결과를 함께 표시합니다.</p></div><TerminalSquare size={19} /></div>
            {detail.questions.length ? <><div className="result-question-tabs">{detail.questions.map((question, index) => <button type="button" className={activeQuestionId === question.id ? 'active' : ''} key={question.id} onClick={() => setActiveQuestionId(question.id)}>문제 {index + 1}: {question.title}</button>)}</div>
              <div className="result-code-heading"><strong>{activeQuestion?.title}</strong><span>{codeAnswer?.language ?? '언어 미선택'}</span></div>
              <pre className="result-code-viewer">{codeAnswer?.source || '저장된 코드가 없습니다.'}</pre>
              <div className="result-run-heading"><strong>실행 결과</strong><span>{runResult?.executedAt ? new Date(runResult.executedAt).toLocaleString('ko-KR') : '실행 기록 없음'}</span></div>
              <pre className={`result-run-viewer ${runResult?.type ?? 'notice'}`}>{runResult?.output || '저장된 실행 결과가 없습니다.'}</pre>
            </> : <p className="empty-state">이 시험에는 코딩 문제가 없습니다.</p>}
          </section>
          <aside className="result-review-section">
            <div className="section-title-row"><div><h3>AI·감독 경고</h3><p>실시간 관제에서 기록된 경고입니다.</p></div><AlertTriangle size={19} /></div>
            <div className="result-warning-list">{detail.warnings.length ? detail.warnings.map((warning, index) => <article key={`${warning.createdAt}-${index}`}><strong>{warning.message}</strong><span>{new Date(warning.createdAt).toLocaleString('ko-KR')}</span></article>) : <p className="empty-state">기록된 경고가 없습니다.</p>}</div>
            <div className="result-review-form"><h3>운영자 검토</h3><label>검토 상태<select value={review.reviewStatus} onChange={(event) => setReview({ ...review, reviewStatus: event.target.value })}>{Object.entries(reviewStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>검토 메모<textarea value={review.reviewNote} onChange={(event) => setReview({ ...review, reviewNote: event.target.value })} placeholder="검토 내용이나 후속 조치 사항을 작성하세요." /></label><button className="primary-button" type="button" disabled={savingReview} onClick={saveReview}><Save size={16} /> {savingReview ? '저장 중...' : '검토 저장'}</button></div>
          </aside>
        </div>
      </section>}
    </section>
  );
}

function ResultMetric({ label, value }) {
  return <div className="result-metric"><span>{label}</span><strong>{value}</strong></div>;
}
