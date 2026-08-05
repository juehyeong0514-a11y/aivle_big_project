import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Building2, Cpu, FileText, LoaderCircle, Save, TerminalSquare, UserRound, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const reviewStatusLabels = { NOT_REVIEWED: '미검토', NORMAL: '정상', REVIEW_REQUIRED: '재검토 필요', SUSPICIOUS: '부정행위 의심' };
const aiStatusLabels = { PENDING: '승인 대기', PROCESSING: '분석 중', COMPLETED: '분석 완료', FAILED: '분석 실패' };

const latestAiRequestFor = (requests, candidateId) => requests
  .filter((item) => item.candidateId === candidateId)
  .sort((first, second) => new Date(second.requestedAt ?? 0) - new Date(first.requestedAt ?? 0))[0];

export default function ReportsTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [results, setResults] = useState([]);
  const [examinees, setExaminees] = useState([]);
  const [aiRequests, setAiRequests] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [detail, setDetail] = useState(null);
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [review, setReview] = useState({ reviewStatus: 'NOT_REVIEWED', reviewNote: '' });
  const [savingReview, setSavingReview] = useState(false);
  const [requestingCandidateId, setRequestingCandidateId] = useState('');
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
      setExaminees([]);
      setAiRequests([]);
      return;
    }
    Promise.all([
      api.get(`/manager/results?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
      api.get(`/supervisor/examinees?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
      api.get(`/manager/ai-grading-requests?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
    ])
      .then(([resultResponse, examineeResponse, aiRequestResponse]) => {
        setResults(resultResponse.data);
        setExaminees(examineeResponse.data);
        setAiRequests(aiRequestResponse.data);
      })
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

  useEffect(() => {
    if (!organizationId || !selectedExamId || !aiRequests.some((item) => ['PENDING', 'PROCESSING'].includes(item.status))) return undefined;
    const refreshRequests = () => api.get(`/manager/ai-grading-requests?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() })
      .then(({ data }) => setAiRequests(data))
      .catch(() => {});
    const timer = window.setInterval(refreshRequests, 5000);
    return () => window.clearInterval(timer);
  }, [organizationId, selectedExamId, aiRequests]);

  useEffect(() => {
    if (!detail) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedCandidateId('');
        setDetail(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [detail]);

  const changeOrganization = (nextOrganizationId) => {
    setError('');
    setMessage('');
    setExams([]);
    setSelectedExamId('');
    setResults([]);
    setExaminees([]);
    setAiRequests([]);
    setOrganizationId(nextOrganizationId);
  };

  const requestAiAnalysis = async (candidateId) => {
    setRequestingCandidateId(candidateId);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/manager/ai-grading-requests', { examId: selectedExamId, candidateId }, { headers: authHeaders() });
      setAiRequests((current) => [...current.filter((item) => !(item.examId === data.examId && item.candidateId === data.candidateId)), data]);
      setMessage('AI 결과 분석을 요청했습니다. 중앙 관리자의 승인 후 분석이 진행됩니다.');
    } catch (reason) {
      setError(apiErrorMessage(reason, 'AI 결과 분석을 요청하지 못했습니다.'));
    } finally {
      setRequestingCandidateId('');
    }
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

  const closeDetail = () => {
    setSelectedCandidateId('');
    setDetail(null);
  };

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);
  const activeQuestion = detail?.questions.find((question) => question.id === activeQuestionId);
  const codeAnswer = activeQuestion && detail?.codingSubmission?.answers?.[activeQuestion.id];
  const runResult = activeQuestion && detail?.codingSubmission?.runResults?.[activeQuestion.id];
  const selectedAiRequest = latestAiRequestFor(aiRequests, selectedCandidateId);

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">EXAMINEE MANAGEMENT</span><h1>응시 현황 및 결과 관리</h1><p>접속 현황부터 제출 결과, 감독 기록과 AI 분석 요청까지 한곳에서 관리합니다.</p></div>
        <div className="workspace-role-mark manager"><BarChart3 size={20} /> 통합 응시자 관리</div>
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
      <div className="data-panel examinee-result-panel">
        <div className="panel-heading"><div><h2>응시자 통합 목록</h2><p>응시자 이름을 누르면 코드, 실행 결과, 경고 및 AI 분석 결과를 확인할 수 있습니다.</p></div><FileText size={20} /></div>
        <table className="status-table examinee-result-table"><thead><tr><th>응시자</th><th>이메일</th><th>접속 상태</th><th>현재 문제</th><th>시험</th><th>제출 상태</th><th>점수</th><th>제출 시간</th><th>AI 결과 분석</th></tr></thead><tbody>
          {results.map((result) => {
            const examinee = examinees.find((item) => item.candidateId === result.candidateId);
            const aiRequest = latestAiRequestFor(aiRequests, result.candidateId);
            const isSubmitted = Boolean(result.submittedAt) || result.status === 'SUBMITTED';
            return <tr key={result.id} className={selectedCandidateId === result.candidateId ? 'active-result-row' : ''}><td><button type="button" className="result-candidate-button" onClick={() => setSelectedCandidateId(result.candidateId)}>{result.candidateName}</button></td><td>{result.candidateEmail}</td><td>{examinee?.statusText || examinee?.status || '미접속'}</td><td>{examinee?.currentProb || '시험 시작 전'}</td><td>{result.examTitle || exams.find((exam) => exam.id === selectedExamId)?.title || '-'}</td><td>{result.resultStatus === 'PENDING_REVIEW' ? '검토 대기' : result.status}</td><td>{result.score ?? '-'}</td><td>{result.submittedAt ? new Date(result.submittedAt).toLocaleString('ko-KR') : '-'}</td><td>{aiRequest?.status === 'COMPLETED' ? <button className="ai-analysis-open-button" type="button" onClick={() => setSelectedCandidateId(result.candidateId)}><Cpu size={14} /> 분석 자료 보기</button> : aiRequest ? <span className={`ai-request-status ${aiRequest.status.toLowerCase()}`}>{aiStatusLabels[aiRequest.status] ?? aiRequest.status}</span> : <button className="secondary-button compact-button" type="button" disabled={!isSubmitted || requestingCandidateId === result.candidateId} title={isSubmitted ? 'AI 결과 분석 요청' : '제출 완료 후 요청할 수 있습니다.'} onClick={() => requestAiAnalysis(result.candidateId)}>{requestingCandidateId === result.candidateId ? <LoaderCircle className="spin" size={14} /> : <Cpu size={14} />} AI 분석 요청</button>}</td></tr>;
          })}
        </tbody></table>
        {!organizationId && <p className="empty-state">결과를 조회할 조직을 선택해주세요.</p>}
        {organizationId && !selectedExamId && <p className="empty-state">결과를 조회할 시험을 선택해주세요.</p>}
        {selectedExamId && !results.length && <p className="empty-state">선택한 시험의 결과가 없습니다.</p>}
      </div>
      {detail && <div className="result-detail-modal" role="dialog" aria-modal="true" aria-labelledby="result-detail-title">
        <button className="result-detail-backdrop" type="button" aria-label="상세 결과 닫기" onClick={closeDetail} />
        <section className="data-panel result-detail-panel">
        <div className="panel-heading"><div><h2 id="result-detail-title"><UserRound size={19} /> {detail.candidate.name} 응시자 상세 결과</h2><p>{detail.candidate.candidateNumber} · {detail.candidate.email}</p></div><div className="result-detail-heading-actions"><span className="status-badge approved">{reviewStatusLabels[detail.result.reviewStatus]}</span><button className="icon-action result-detail-close" type="button" aria-label="상세 결과 닫기" onClick={closeDetail}><X size={19} /></button></div></div>
        <div className="result-summary-grid">
          <ResultMetric label="제출 상태" value={detail.result.resultStatus === 'PENDING_REVIEW' ? '검토 대기' : detail.result.status} />
          <ResultMetric label="점수" value={detail.result.score ?? '채점 대기'} />
          <ResultMetric label="제출 시간" value={detail.result.submittedAt ? new Date(detail.result.submittedAt).toLocaleString('ko-KR') : '미제출'} />
          <ResultMetric label="감독 경고" value={`${detail.warnings.length}건`} />
          <ResultMetric label="AI 결과 분석" value={selectedAiRequest ? (aiStatusLabels[selectedAiRequest.status] ?? selectedAiRequest.status) : '요청 전'} />
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
            {selectedAiRequest?.status === 'FAILED' && <div className="workspace-alert error">{selectedAiRequest.errorMessage || 'AI 분석에 실패했습니다.'}</div>}
            <div className="result-review-form"><h3>운영자 검토</h3><label>검토 상태<select value={review.reviewStatus} onChange={(event) => setReview({ ...review, reviewStatus: event.target.value })}>{Object.entries(reviewStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>검토 메모<textarea value={review.reviewNote} onChange={(event) => setReview({ ...review, reviewNote: event.target.value })} placeholder="검토 내용이나 후속 조치 사항을 작성하세요." /></label><button className="primary-button" type="button" disabled={savingReview} onClick={saveReview}><Save size={16} /> {savingReview ? '저장 중...' : '검토 저장'}</button></div>
          </aside>
        </div>
        {selectedAiRequest?.status === 'COMPLETED' && <div className="result-analysis-section"><AiAnalysisResult result={selectedAiRequest.result} /></div>}
        </section>
      </div>}
    </section>
  );
}

function ResultMetric({ label, value }) {
  return <div className="result-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function AiAnalysisResult({ result = {} }) {
  const analysisResult = result.output && typeof result.output === 'object' && !Array.isArray(result.output) ? result.output : result;
  const breakdown = Array.isArray(analysisResult.rubricBreakdown) ? analysisResult.rubricBreakdown : [];
  const maxScore = analysisResult.maxScore ?? breakdown[0]?.maxScore ?? 30;
  return <section className="ai-analysis-result" aria-labelledby="ai-analysis-result-title">
    <div className="ai-analysis-summary"><div><h3 id="ai-analysis-result-title">AI 분석 자료</h3><p>{analysisResult.feedback || '분석이 완료되었습니다.'}</p></div><strong>{analysisResult.score ?? '-'} / {maxScore}점</strong></div>
    {breakdown.length ? <div className="ai-analysis-question-list">{breakdown.map((item, index) => <article key={item.questionId ?? index}>
      <div className="ai-analysis-question-heading"><strong>{item.title || `문제 ${index + 1}`}</strong><span>{item.score ?? '-'} / {item.maxScore ?? 30}점</span></div>
      {(item.algorithmScore != null || item.codeQualityScore != null) && <div className="ai-analysis-score-grid">
        <ResultMetric label="알고리즘" value={`${item.algorithmScore ?? '-'} / 20`} />
        <ResultMetric label="코드 품질" value={`${item.codeQualityScore ?? '-'} / 10`} />
      </div>}
      <ComplexityAnalysis label="시간 복잡도" value={item.timeComplexity} />
      <ComplexityAnalysis label="공간 복잡도" value={item.spaceComplexity} />
      {Array.isArray(item.deductions) && item.deductions.length > 0 && <div className="ai-analysis-deductions"><strong>감점 사유</strong><ul>{item.deductions.map((deduction, deductionIndex) => <li key={deductionIndex}><span>-{deduction.points ?? 0}점</span> {deduction.reason || deduction.category}</li>)}</ul></div>}
      {item.feedback && <div className="ai-analysis-feedback"><strong>피드백</strong><p>{item.feedback}</p></div>}
      {item.algorithmScore == null && item.codeQualityScore == null && item.breakdown && <div className="ai-analysis-legacy-rubrics">{Object.entries(item.breakdown).map(([name, rubric]) => <div key={name}><strong>{name}</strong><span>{rubric?.score ?? '-'} / {rubric?.maxScore ?? '-'}</span><p>{rubric?.feedback}</p></div>)}</div>}
    </article>)}</div> : <p className="empty-state">문제별 분석 자료가 없습니다.</p>}
  </section>;
}

function ComplexityAnalysis({ label, value }) {
  if (!value) return null;
  const analysis = typeof value === 'string' ? value : value.analysis;
  const estimated = typeof value === 'object' ? value.estimated : '';
  const expected = typeof value === 'object' ? value.expected : '';
  return <div className="ai-complexity-analysis"><strong>{label}</strong><span>{estimated || '-'}{expected ? ` · 기준 ${expected}` : ''}</span>{analysis && <p>{analysis}</p>}</div>;
}
