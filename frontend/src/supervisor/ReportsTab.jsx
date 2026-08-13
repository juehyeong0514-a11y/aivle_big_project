import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Building2, Cpu, FileText, LoaderCircle, MailCheck, RefreshCw, RotateCcw, Save, TerminalSquare, UserRound, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';
import { automationRecoveryActionsFor, automationStateFor, deriveAutomationSummary } from '../automationUi.mjs';

const reviewStatusLabels = { NOT_REVIEWED: '미검토', NORMAL: '정상', REVIEW_REQUIRED: '재검토 필요', SUSPICIOUS: '부정행위 의심' };

const asList = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.items) ? payload.items : []);
const payloadSummary = (payload) => payload && !Array.isArray(payload) && payload.examAutomationSummary && typeof payload.examAutomationSummary === 'object' ? payload.examAutomationSummary : null;
const automationCandidates = (payload) => Array.isArray(payload?.candidates) ? payload.candidates : [];
const mergeAutomationProjection = (results, projection) => {
  const states = automationCandidates(projection);
  if (!states.length) return results;
  return results.map((result) => {
    const state = states.find((item) => item.candidateId === result.candidateId);
    if (!state) return result;
    return { ...result, automationStatus: state.status || result.automationStatus, automationFailureReason: state.lastError || state.errorMessage || result.automationFailureReason, retryCount: state.retryCount ?? result.retryCount, nextRetryAt: state.nextRetryAt ?? result.nextRetryAt, resultEmailStatus: state.email?.status || result.resultEmailStatus, resultEmailedAt: state.email?.sentAt || result.resultEmailedAt, resultEmailFailureReason: state.email?.lastError || result.resultEmailFailureReason };
  });
};
const projectionSummary = (projection) => {
  const states = automationCandidates(projection);
  if (!states.length) return null;
  const status = (item) => String(item.status || '').toUpperCase();
  const completed = states.filter((item) => ['COMPLETED', 'FINALIZED', 'EMAIL_SENT'].includes(status(item))).length;
  const processing = states.filter((item) => ['PENDING', 'FINALIZING', 'GRADING', 'EMAIL_PENDING', 'EMAIL_SENDING'].includes(status(item))).length;
  const failed = states.filter((item) => ['GRADING_FAILED', 'EMAIL_FAILED', 'FAILED'].includes(status(item))).length;
  const absent = states.filter((item) => status(item) === 'ABSENT').length;
  const excluded = states.filter((item) => status(item) === 'EXCLUDED').length;
  const emailSent = states.filter((item) => ['SENT', 'EMAIL_SENT'].includes(String(item.email?.status || '').toUpperCase()) || item.email?.sentAt).length;
  const emailFailed = states.filter((item) => String(item.email?.status || '').toUpperCase() === 'FAILED').length;
  return { total: states.length, completed, processing, failed, absent, excluded, emailSent, emailFailed, progress: states.length ? Math.round((completed + absent + excluded) / states.length * 100) : 0 };
};

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
  const [recoveringRequestId, setRecoveringRequestId] = useState('');
  const [automationSummary, setAutomationSummary] = useState(null);
  const [automationExamState, setAutomationExamState] = useState(null);
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
      setAutomationSummary(null);
      setAutomationExamState(null);
      return;
    }
    Promise.all([
      api.get(`/manager/results?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
      api.get(`/supervisor/examinees?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
      api.get(`/manager/ai-grading-requests?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
      api.get(`/manager/exams/${encodeURIComponent(selectedExamId)}/automation-status`, { headers: authHeaders() }).catch(() => ({ data: null })),
    ])
      .then(([resultResponse, examineeResponse, aiRequestResponse, automationResponse]) => {
        const nextResults = mergeAutomationProjection(asList(resultResponse.data), automationResponse.data);
        const nextRequests = asList(aiRequestResponse.data);
        setResults(nextResults);
        setExaminees(asList(examineeResponse.data));
        setAiRequests(nextRequests);
        setAutomationExamState(automationResponse.data?.state ?? null);
        setAutomationSummary(projectionSummary(automationResponse.data) || deriveAutomationSummary(nextResults, nextRequests, payloadSummary(resultResponse.data) || payloadSummary(aiRequestResponse.data)));
      })
      .catch((reason) => setError(apiErrorMessage(reason, '결과를 불러오지 못했습니다.')));
  }, [organizationId, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId || !selectedCandidateId) return;
    setMessage('');
    api.get(`/manager/exams/${encodeURIComponent(selectedExamId)}/results/${encodeURIComponent(selectedCandidateId)}`, { headers: authHeaders() })
      .then(({ data }) => {
        const forceTerminated = Boolean(data.result?.forceTermination);
        setDetail(forceTerminated ? {
          ...data,
          result: {
            ...data.result,
            status: '\uAC15\uC81C \uC885\uB8CC\u00B7\uD0C8\uB77D',
            score: '-',
            submittedAt: data.result.forceTermination.terminatedAt
          }
        } : data);
        setActiveQuestionId(data.questions[0]?.id || '');
        setReview({ reviewStatus: data.result.reviewStatus, reviewNote: data.result.reviewNote });
      })
      .catch((reason) => setError(apiErrorMessage(reason, '응시자 상세 결과를 불러오지 못했습니다.')));
  }, [selectedExamId, selectedCandidateId]);

  useEffect(() => {
    const hasProcessing = aiRequests.some((item) => ['PENDING', 'PROCESSING', 'FINALIZING', 'GRADING', 'EMAIL_SENDING'].includes(String(item.automationStatus || item.status).toUpperCase()))
      || results.some((item) => ['PENDING', 'PROCESSING', 'FINALIZING', 'GRADING', 'EMAIL_PENDING', 'EMAIL_SENDING'].includes(String(item.automationStatus || item.status).toUpperCase()));
    const hasEndedPendingExam = automationExamState?.status === 'PENDING' && automationExamState.cutoffAt && Date.parse(automationExamState.cutoffAt) <= Date.now();
    if (!organizationId || !selectedExamId || (!hasProcessing && !hasEndedPendingExam)) return undefined;
    let active = true;
    const refreshRequests = () => Promise.all([
      api.get(`/manager/results?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
      api.get(`/manager/ai-grading-requests?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() }),
      api.get(`/manager/exams/${encodeURIComponent(selectedExamId)}/automation-status`, { headers: authHeaders() }).catch(() => ({ data: null }))
    ]).then(([resultResponse, requestResponse, automationResponse]) => {
      if (!active) return;
      const nextResults = mergeAutomationProjection(asList(resultResponse.data), automationResponse.data);
      const nextRequests = asList(requestResponse.data);
      setResults(nextResults);
      setAiRequests(nextRequests);
      setAutomationExamState(automationResponse.data?.state ?? null);
      setAutomationSummary(projectionSummary(automationResponse.data) || deriveAutomationSummary(nextResults, nextRequests, payloadSummary(resultResponse.data) || payloadSummary(requestResponse.data)));
    }).catch(() => {});
    const timer = window.setInterval(refreshRequests, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [organizationId, selectedExamId, aiRequests, automationExamState, results]);

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
    setAutomationSummary(null);
    setAutomationExamState(null);
    setOrganizationId(nextOrganizationId);
  };

  const recoverAutomation = async (aiRequest, action = 'retry', candidateId = selectedCandidateId) => {
    setRecoveringRequestId(aiRequest?.id || candidateId);
    setError('');
    setMessage('');
    try {
      const endpoint = action === 'resend' ? `/manager/ai-grading-requests/${encodeURIComponent(aiRequest.id)}/send-result-email` : `/manager/exams/${encodeURIComponent(selectedExamId)}/automation/retry`;
      const { data } = await api.post(endpoint, action === 'resend' ? {} : { candidateId }, { headers: authHeaders() });
      if (data?.id) setAiRequests((current) => current.map((item) => item.id === data.id ? data : item));
      setMessage(action === 'resend' ? '실패한 결과 메일을 다시 발송했습니다.' : '실패한 자동 채점을 다시 시작했습니다.');
    } catch (reason) {
      setError(apiErrorMessage(reason, action === 'resend' ? '결과 메일을 다시 발송하지 못했습니다.' : '자동 채점을 다시 시작하지 못했습니다.'));
    } finally {
      setRecoveringRequestId('');
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
  const isDetailForceTerminated = Boolean(detail?.result?.forceTermination);
  const selectedAiRequest = isDetailForceTerminated ? null : latestAiRequestFor(aiRequests, selectedCandidateId);
  const selectedAutomation = automationStateFor(detail?.result, selectedAiRequest, null, isDetailForceTerminated);
  const selectedRecoveryActions = automationRecoveryActionsFor(detail?.result, selectedAiRequest, null, isDetailForceTerminated);
  const summary = useMemo(() => automationSummary || deriveAutomationSummary(results, aiRequests, null), [automationSummary, results, aiRequests]);

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">EXAM RESULTS</span><h1>응시 결과 관리</h1><p>응시 현황부터 제출 결과, 감독 기록과 자동 처리 상태까지 한곳에서 관리합니다.</p></div>
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
       {selectedExamId && <AutomationSummary summary={summary} />}
       <div className="data-panel examinee-result-panel">
         <div className="panel-heading"><div><h2>응시자 통합 목록</h2><p>시험 종료 후 자동 마감·채점·결과 메일 진행 상태를 확인합니다.</p></div><FileText size={20} /></div>
         <table className="status-table examinee-result-table"><thead><tr><th>응시자</th><th>이메일</th><th>접속 상태</th><th>현재 문제</th><th>시험</th><th>제출 상태</th><th>점수</th><th>제출 시간</th><th>자동 처리</th></tr></thead><tbody>
           {results.map((result) => {
             const examinee = examinees.find((item) => item.candidateId === result.candidateId);
             const aiRequest = latestAiRequestFor(aiRequests, result.candidateId);
             const isForceTerminated = result.status === 'FORCE_TERMINATED' || result.resultStatus === 'DISQUALIFIED' || examinee?.status === 'FORCE_TERMINATED';
             const automation = automationStateFor(result, aiRequest, examinee, isForceTerminated);
             const recoveryActions = automationRecoveryActionsFor(result, aiRequest, examinee, isForceTerminated);
             const canRetry = recoveryActions.includes('RETRY_GRADING');
             const canResend = recoveryActions.includes('RESEND_EMAIL');
             const resultStatusLabel = isForceTerminated ? '강제 종료·탈락' : result.resultStatus === 'PENDING_REVIEW' ? '검토 대기' : result.status;
             return <tr key={result.id || result.candidateId} className={(selectedCandidateId === result.candidateId ? 'active-result-row ' : '') + (isForceTerminated ? 'force-terminated-result-row' : '')}><td><button type="button" className="result-candidate-button" onClick={() => setSelectedCandidateId(result.candidateId)}>{result.candidateName}</button></td><td>{result.candidateEmail}</td><td>{isForceTerminated ? '시험 종료' : examinee?.statusText || examinee?.status || '미접속'}</td><td>{examinee?.currentProb || '시험 시작 전'}</td><td>{result.examTitle || exams.find((exam) => exam.id === selectedExamId)?.title || '-'}</td><td><span className={isForceTerminated ? 'result-status-danger' : ''}>{resultStatusLabel}</span></td><td>{isForceTerminated ? '-' : result.score ?? '-'}</td><td>{isForceTerminated ? (result.forceTerminatedAt ? new Date(result.forceTerminatedAt).toLocaleString('ko-KR') : '-') : result.submittedAt ? new Date(result.submittedAt).toLocaleString('ko-KR') : '-'}</td><td><div className="ai-result-actions"><span className={`ai-request-status automation-${automation.status.toLowerCase()}`}>{automation.label}</span>{automation.reason && <small className="automation-failure-reason">{automation.reason}</small>}{automation.completed && <button className="ai-analysis-open-button" type="button" onClick={() => setSelectedCandidateId(result.candidateId)}><Cpu size={14} /> 분석 자료 보기</button>}{canRetry && <button className="secondary-button compact-button" type="button" onClick={() => recoverAutomation(aiRequest, 'retry', result.candidateId)} disabled={recoveringRequestId === aiRequest.id}>{recoveringRequestId === aiRequest.id ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} 채점 재시도</button>}{canResend && <button className="secondary-button compact-button" type="button" onClick={() => recoverAutomation(aiRequest, 'resend', result.candidateId)} disabled={recoveringRequestId === aiRequest.id}>{recoveringRequestId === aiRequest.id ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} 메일 재발송</button>}</div></td></tr>;
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
           <ResultMetric label="자동 처리" value={selectedAutomation.label} />
        </div>
        {detail.result.forceTermination && <section className="force-termination-record"><h3>강제 종료 기록</h3><dl><div><dt>최종 결과</dt><dd>탈락</dd></div><div><dt>종료 일시</dt><dd>{new Date(detail.result.forceTermination.terminatedAt).toLocaleString('ko-KR')}</dd></div><div><dt>처리 감독관</dt><dd>{detail.result.forceTermination.actorName}</dd></div><div><dt>종료 사유</dt><dd>{detail.result.forceTermination.reason}</dd></div><div><dt>상세 사유</dt><dd>{detail.result.forceTermination.detail}</dd></div><div><dt>종료 당시 문제</dt><dd>{detail.result.forceTermination.currentProb}</dd></div></dl></section>}
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
             {selectedAutomation.reason && !selectedAutomation.excluded && <div className="workspace-alert error automation-detail-failure"><strong>{selectedAutomation.label}</strong><span>{selectedAutomation.reason}</span>{selectedRecoveryActions.includes('RETRY_GRADING') && <button className="secondary-button compact-button" type="button" onClick={() => recoverAutomation(selectedAiRequest, 'retry', selectedCandidateId)} disabled={recoveringRequestId === selectedAiRequest.id}>{recoveringRequestId === selectedAiRequest.id ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} 채점 재시도</button>}{selectedRecoveryActions.includes('RESEND_EMAIL') && <button className="secondary-button compact-button" type="button" onClick={() => recoverAutomation(selectedAiRequest, 'resend', selectedCandidateId)} disabled={recoveringRequestId === selectedAiRequest.id}>{recoveringRequestId === selectedAiRequest.id ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} 메일 재발송</button>}</div>}
            <div className="result-review-form"><h3>운영자 검토</h3><label>검토 상태<select value={review.reviewStatus} onChange={(event) => setReview({ ...review, reviewStatus: event.target.value })}>{Object.entries(reviewStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>검토 메모<textarea value={review.reviewNote} onChange={(event) => setReview({ ...review, reviewNote: event.target.value })} placeholder="검토 내용이나 후속 조치 사항을 작성하세요." /></label><button className="primary-button" type="button" disabled={savingReview} onClick={saveReview}><Save size={16} /> {savingReview ? '저장 중...' : '검토 저장'}</button></div>
          </aside>
        </div>
        {selectedAiRequest?.status === 'COMPLETED' && <div className="result-analysis-section"><AiAnalysisResult result={selectedAiRequest.result} /></div>}
        </section>
      </div>}
    </section>
  );
}

function AutomationSummary({ summary = {} }) {
  const total = Number(summary.total) || 0;
  const progress = Math.max(0, Math.min(100, Number(summary.progress) || 0));
  return <section className="data-panel automation-summary" aria-labelledby="automation-summary-title">
    <div className="automation-summary-heading"><div><span className="workspace-eyebrow">EXAM-END AUTOMATION</span><h2 id="automation-summary-title">자동 처리 진행률</h2><p>시험 종료 후 응시자 마감, AI 채점, 결과 메일 상태를 자동으로 갱신합니다.</p></div><strong>{progress}%</strong></div>
    <div className="automation-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress} aria-label="시험 자동 처리 진행률"><span style={{ width: `${progress}%` }} /></div>
    <div className="automation-summary-stats"><SummaryStat label="전체" value={total} /><SummaryStat label="처리 중" value={summary.processing ?? 0} tone="processing" /><SummaryStat label="완료" value={summary.completed ?? 0} tone="success" /><SummaryStat label="실패" value={summary.failed ?? 0} tone="danger" /><SummaryStat label="결시" value={summary.absent ?? 0} /><SummaryStat label="제외" value={summary.excluded ?? 0} /><SummaryStat label="메일 완료" value={summary.emailSent ?? 0} tone="success" /><SummaryStat label="메일 실패" value={summary.emailFailed ?? 0} tone="danger" /></div>
  </section>;
}

function SummaryStat({ label, value, tone = '' }) {
  return <div className={`automation-summary-stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ResultMetric({ label, value }) {
  return <div className="result-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function AiAnalysisResult({ result = {} }) {
  const analysisResult = result.output && typeof result.output === 'object' && !Array.isArray(result.output) ? result.output : result;
  const breakdown = Array.isArray(analysisResult.rubricBreakdown) ? analysisResult.rubricBreakdown : [];
  const maxScore = analysisResult.maxScore ?? breakdown[0]?.maxScore ?? 30;
  return <section className="ai-analysis-result" aria-labelledby="ai-analysis-result-title">
    <div className="ai-analysis-summary">
      <div className="ai-analysis-summary-copy"><span className="ai-analysis-kicker">AI REVIEW</span><h3 id="ai-analysis-result-title">AI 분석 자료</h3><p>{analysisResult.feedback || '분석이 완료되었습니다.'}</p></div>
      <div className="ai-analysis-total-score"><span>총점</span><strong>{analysisResult.score ?? '-'}</strong><small>/ {maxScore}점</small></div>
    </div>
    {breakdown.length ? <div className="ai-analysis-question-list">{breakdown.map((item, index) => <article key={item.questionId ?? index}>
      <div className="ai-analysis-question-heading"><div><small>문제 {index + 1}</small><strong>{item.title || `문제 ${index + 1}`}</strong></div><span>{item.score ?? '-'} / {item.maxScore ?? 30}점</span></div>
      {(item.algorithmScore != null || item.codeQualityScore != null) && <section className="ai-analysis-part score-part"><h4><span>01</span> 채점 항목</h4><div className="ai-analysis-score-grid">
        <ResultMetric label="알고리즘 정확성" value={`${item.algorithmScore ?? '-'} / 20`} />
        <ResultMetric label="코드 품질" value={`${item.codeQualityScore ?? '-'} / 10`} />
      </div></section>}
      {(item.timeComplexity || item.spaceComplexity) && <section className="ai-analysis-part complexity-part"><h4><span>02</span> 효율성 분석</h4><div className="ai-analysis-complexity-grid"><ComplexityAnalysis label="시간 복잡도" value={item.timeComplexity} /><ComplexityAnalysis label="공간 복잡도" value={item.spaceComplexity} /></div></section>}
      {Array.isArray(item.deductions) && item.deductions.length > 0 && <section className="ai-analysis-part deduction-part"><h4><span>03</span> 감점 내역</h4><div className="ai-analysis-deductions"><ul>{item.deductions.map((deduction, deductionIndex) => <li key={deductionIndex}><span>-{deduction.points ?? 0}점</span> {deduction.reason || deduction.category}</li>)}</ul></div></section>}
      {item.feedback && <section className="ai-analysis-part feedback-part"><h4><span>04</span> 종합 피드백</h4><div className="ai-analysis-feedback"><p>{item.feedback}</p></div></section>}
      {item.algorithmScore == null && item.codeQualityScore == null && item.breakdown && <section className="ai-analysis-part score-part"><h4><span>01</span> 채점 기준별 결과</h4><div className="ai-analysis-legacy-rubrics">{Object.entries(item.breakdown).map(([name, rubric]) => <div key={name}><strong>{name}</strong><span>{rubric?.score ?? '-'} / {rubric?.maxScore ?? '-'}</span><p>{rubric?.feedback}</p></div>)}</div></section>}
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
