import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, LoaderCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';
import { deriveAutomationSummary, localizeAutomationFailure, selectAutomationScope, sortAutomationExams } from '../automationUi.mjs';

const statusLabel = { PENDING: '자동 처리 대기', PROCESSING: 'AI 채점 중', FINALIZING: '응시 마감 처리 중', GRADING: 'AI 채점 중', COMPLETED: '채점 완료', FINALIZED: '자동 처리 완료', EMAIL_PENDING: '결과 메일 대기', EMAIL_SENDING: '결과 메일 발송 중', EMAIL_SENT: '결과 메일 발송 완료', FAILED: '채점 실패', GRADING_FAILED: '채점 실패', EMAIL_FAILED: '결과 메일 실패', ABSENT: '결시·제외', EXCLUDED: '강제 종료·제외' };
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';
const asList = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.requests) ? payload.requests : Array.isArray(payload?.items) ? payload.items : []);
const asExams = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.exams) ? payload.exams : []);
const summaryFor = (requests, explicit) => explicit && typeof explicit === 'object' ? explicit : {
  total: requests.length,
  processing: requests.filter((item) => ['PROCESSING', 'FINALIZING', 'GRADING', 'EMAIL_SENDING'].includes(String(item.automationStatus || item.status).toUpperCase())).length,
  completed: requests.filter((item) => ['COMPLETED', 'EMAIL_SENT'].includes(String(item.automationStatus || item.status).toUpperCase())).length,
  failed: requests.filter((item) => ['FAILED', 'GRADING_FAILED', 'EMAIL_FAILED'].includes(String(item.automationStatus || item.status).toUpperCase())).length,
  progress: requests.length ? Math.round(requests.filter((item) => ['COMPLETED', 'EMAIL_SENT', 'ABSENT', 'EXCLUDED'].includes(String(item.automationStatus || item.status).toUpperCase())).length / requests.length * 100) : 0,
};
const effectiveStatus = (request) => {
  const status = String(request?.automationStatus || request?.status || 'PENDING').toUpperCase();
  const emailSent = String(request?.resultEmailStatus || '').toUpperCase() === 'SENT' || Boolean(request?.resultEmailedAt);
  return status === 'COMPLETED' && emailSent ? 'EMAIL_SENT' : status;
};
const recoveryStatus = (status) => ['FAILED', 'GRADING_FAILED', 'EMAIL_FAILED'].includes(status);
const summaryForScope = (requests, candidates, explicit, examId) => {
  if (!examId || examId === 'ALL') return summaryFor(requests, explicit);
  const candidateResults = candidates.map((candidate) => ({ candidateId: candidate.candidateId, automationStatus: candidate.status, resultStatus: candidate.status, resultEmailStatus: candidate.email?.status, resultEmailedAt: candidate.email?.sentAt }));
  return candidateResults.length ? deriveAutomationSummary(candidateResults, requests) : summaryFor(requests);
};

export default function AiGradingQueueTab() {
  const [requests, setRequests] = useState([]);
  const [automationCandidates, setAutomationCandidates] = useState([]);
  const [automationExamStates, setAutomationExamStates] = useState([]);
  const [automationSummary, setAutomationSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [acceptingId, setAcceptingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, { data: summaryData }, { data: examsData }] = await Promise.all([
        api.get('/admin/ai-grading-requests', { headers: authHeaders() }),
        api.get('/admin/ai-invocation-logs/automation-summary', { headers: authHeaders() }).catch(() => ({ data: null })),
        api.get('/admin/exams', { headers: authHeaders() }).catch(() => ({ data: [] })),
      ]);
      const examList = sortAutomationExams(asExams(examsData));
      const examById = new Map(examList.map((exam) => [exam.id, exam]));
      const nextRequests = asList(data).map((request) => ({ ...request, examTitle: request.examTitle || examById.get(request.examId)?.title || '시험 정보 없음', organizationName: request.organizationName || examById.get(request.examId)?.organizationName }));
      setExams(examList);
      setSelectedExamId((current) => {
        if (!current) return examList[0]?.id || 'ALL';
        if (current === 'ALL' || examList.some((exam) => exam.id === current)) return current;
        return examList[0]?.id || 'ALL';
      });
      setRequests(nextRequests);
      setAutomationSummary(summaryFor(nextRequests, summaryData || data?.examAutomationSummary || data?.automationSummary));
      const candidatesByExam = await Promise.all(asExams(examsData).map(async (exam) => {
        try {
          const { data: projection } = await api.get(`/admin/exams/${encodeURIComponent(exam.id)}/automation-status`, { headers: authHeaders() });
          return { state: projection?.state, candidates: (Array.isArray(projection?.candidates) ? projection.candidates : []).map((candidate) => ({ ...candidate, examId: candidate.examId || exam.id, examTitle: exam.title, organizationName: exam.organizationName })) };
        } catch {
          return { state: null, candidates: [] };
        }
      }));
      const summaryCandidates = (Array.isArray(summaryData?.candidates) ? summaryData.candidates : []).map((candidate) => ({ ...candidate, examTitle: candidate.examTitle || examById.get(candidate.examId)?.title || '시험 정보 없음', organizationName: candidate.organizationName || examById.get(candidate.examId)?.organizationName }));
      setAutomationExamStates(candidatesByExam.map((item) => item.state).filter(Boolean));
      const mergedCandidates = [...candidatesByExam.flatMap((item) => item.candidates), ...summaryCandidates];
      setAutomationCandidates(mergedCandidates.filter((candidate, index, items) => items.findIndex((item) => `${item.examId}:${item.candidateId}` === `${candidate.examId}:${candidate.candidateId}`) === index));
      setMessage('');
    } catch (error) {
      setMessage(apiErrorMessage(error, '자동 처리 현황을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const hasProcessing = requests.some((request) => ['PROCESSING', 'FINALIZING', 'GRADING', 'EMAIL_SENDING'].includes(effectiveStatus(request)))
      || automationCandidates.some((candidate) => ['PENDING', 'PROCESSING', 'FINALIZING', 'GRADING', 'EMAIL_PENDING', 'EMAIL_SENDING'].includes(String(candidate.status || '').toUpperCase()));
    const hasEndedPendingExam = automationExamStates.some((state) => state.status === 'PENDING' && state.cutoffAt && Date.parse(state.cutoffAt) <= Date.now());
    if (!hasProcessing && !hasEndedPendingExam) return undefined;
    const timer = window.setInterval(() => load().catch(() => {}), 4000);
    return () => window.clearInterval(timer);
  }, [automationCandidates, automationExamStates, load, requests]);

  const retryGrading = async (request) => {
    setAcceptingId(request.id);
    try {
      const { data } = await api.post(`/admin/ai-grading-requests/${request.id}/retry`, {}, { headers: authHeaders() });
      setRequests((current) => current.map((item) => item.id === request.id ? data : item));
      setMessage('실패한 채점의 재시도를 시작했습니다. 호출 기록에서 새 실행을 확인할 수 있습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, '채점을 다시 실행하지 못했습니다.'));
    } finally {
      setAcceptingId('');
    }
  };
  const retryEmail = async (request) => {
    setAcceptingId(request.id);
    try {
      const { data } = await api.post(`/admin/exams/${encodeURIComponent(request.examId)}/automation/retry`, { candidateId: request.candidateId }, { headers: authHeaders() });
      const candidateState = data?.candidates?.find((item) => item.candidateId === request.candidateId);
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, automationStatus: candidateState?.status || 'EMAIL_PENDING', automationFailureReason: candidateState?.failureReason || '', resultEmailFailureReason: candidateState?.email?.failureReason || '', resultEmailStatus: candidateState?.email?.status || item.resultEmailStatus, nextRetryAt: candidateState?.email?.nextAttemptAt || item.nextRetryAt } : item));
      setMessage('실패한 결과 메일의 재발송을 시작했습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, '결과 메일을 다시 발송하지 못했습니다.'));
    } finally {
      setAcceptingId('');
    }
  };
  const recoverCandidate = async (candidate) => {
    const recoveryId = `${candidate.examId}:${candidate.candidateId}`;
    setAcceptingId(recoveryId);
    try {
      await api.post(`/admin/exams/${encodeURIComponent(candidate.examId)}/automation/retry`, { candidateId: candidate.candidateId }, { headers: authHeaders() });
      setMessage(candidate.status === 'EMAIL_FAILED' ? '실패한 결과 메일의 재발송을 시작했습니다.' : '실패한 자동 채점의 재시도를 시작했습니다.');
      await load();
    } catch (error) {
      setMessage(apiErrorMessage(error, '자동 처리 복구를 시작하지 못했습니다.'));
    } finally {
      setAcceptingId('');
    }
  };
  const scopeId = selectedExamId || 'ALL';
  const selectedExam = exams.find((exam) => exam.id === scopeId);
  const scopeLabel = selectedExam?.title || '전체 시험';
  const scopedRequests = selectAutomationScope(requests, scopeId);
  const scopedCandidates = selectAutomationScope(automationCandidates, scopeId);
  const summary = summaryForScope(scopedRequests, scopedCandidates, automationSummary, scopeId);
  const requestKeys = new Set(scopedRequests.map((request) => `${request.examId}:${request.candidateId}`));
  const candidateRows = scopedCandidates.filter((candidate) => !requestKeys.has(`${candidate.examId}:${candidate.candidateId}`));
  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">자동 처리 운영</span><h1>자동 처리 현황</h1><p>시험 종료 자동 마감·AI 채점·결과 메일의 진행 상태와 후보별 실패 복구를 관리합니다.</p></div><button className="secondary-button" type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> 새로고침</button></div>{message && <div className="workspace-alert">{message}</div>}<AutomationExamFilter exams={exams} value={scopeId} onChange={setSelectedExamId} /><AutomationQueueSummary summary={summary} examTitle={scopeLabel} /><div className="data-panel"><div className="panel-heading"><div><h2>{scopeLabel} 후보 자동 처리 상태</h2><p>실패한 채점은 다시 실행하고, 결과 메일 실패는 메일 재발송으로 복구합니다.</p></div><Cpu size={20} /></div><div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>요청 조직</th><th>상태 시각</th><th>대상 후보 / 시험</th><th>자동 처리 상태</th><th>복구</th></tr></thead><tbody>{scopedRequests.length === 0 && candidateRows.length === 0 ? <tr><td colSpan="5">{loading ? '자동 처리 현황을 불러오는 중입니다.' : '표시할 후보 상태가 없습니다.'}</td></tr> : <>{scopedRequests.map((request) => <AutomationRequestRow key={request.id} request={request} acceptingId={acceptingId} onRetryGrading={retryGrading} onRetryEmail={retryEmail} />)}{candidateRows.map((candidate) => <AutomationCandidateRow key={`${candidate.examId}:${candidate.candidateId}`} candidate={candidate} acceptingId={acceptingId} onRecover={recoverCandidate} />)}</>}</tbody></table></div></div></section>;
}

function AutomationExamFilter({ exams, value, onChange }) {
  return <div className="automation-exam-filter"><label htmlFor="automation-exam-scope">시험 범위<select id="automation-exam-scope" value={value} onChange={(event) => onChange(event.target.value)}><option value="ALL">전체 시험</option>{exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title || '시험 정보 없음'} · {exam.date || formatDate(exam.scheduledAt || exam.startAt || exam.examDate || exam.createdAt)}</option>)}</select></label><span>{value === 'ALL' ? '모든 시험의 자동 처리 상태' : '선택한 시험의 자동 처리 상태'}</span></div>;
}

function AutomationQueueSummary({ summary = {}, examTitle = '전체 시험' }) {
  const progress = Math.max(0, Math.min(100, Number(summary.progress) || 0));
  return <section className="data-panel automation-summary"><div className="automation-summary-heading"><div><span className="workspace-eyebrow">AUTOMATION MONITOR</span><h2>{examTitle} 자동 처리 진행률</h2><p>{summary.total ?? 0}건 · 처리 중 {summary.processing ?? 0}건 · 실패 {summary.failed ?? 0}건 · 결시 {summary.absent ?? 0}건 · 제외 {summary.excluded ?? 0}건</p></div><strong>{progress}%</strong></div><div className="automation-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress} aria-label={`${examTitle} 자동 처리 진행률`}><span style={{ width: `${progress}%` }} /></div></section>;
}

function AutomationRequestRow({ request, acceptingId, onRetryGrading, onRetryEmail }) {
  const status = effectiveStatus(request);
  const reason = localizeAutomationFailure(request.automationFailureReason || request.resultEmailFailureReason || request.errorMessage);
  return <tr><td>{request.organizationName || '조직 정보 없음'}</td><td>{formatDate(request.requestedAt || request.updatedAt)}</td><td><strong>{request.candidateName || '응시자 정보 없음'}</strong><br /><span className="form-hint">{request.examTitle || '시험 정보 없음'}</span></td><td><span className={`ai-request-status automation-${status.toLowerCase()}`}>{statusLabel[status] ?? status}</span>{request.retryCount ? <><br /><span className="form-hint">재시도 {request.retryCount}회{request.nextRetryAt ? ` · 다음 ${formatDate(request.nextRetryAt)}` : ''}</span></> : null}{reason ? <><br /><span className="form-error">{reason}</span></> : null}</td><td>{status === 'EMAIL_FAILED' ? <button className="secondary-button compact-button" type="button" onClick={() => onRetryEmail(request)} disabled={acceptingId === request.id}>{acceptingId === request.id ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} 메일 재발송</button> : recoveryStatus(status) && status !== 'EMAIL_FAILED' ? <button className="primary-button compact-button" type="button" onClick={() => onRetryGrading(request)} disabled={acceptingId === request.id}>{acceptingId === request.id ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} 다시 채점</button> : <span className="form-hint">{status === 'PENDING' ? '자동 처리 대기' : '복구 작업 없음'}</span>}</td></tr>;
}

function AutomationCandidateRow({ candidate, acceptingId, onRecover }) {
  const status = String(candidate.status || 'WAITING').toUpperCase() === 'COMPLETED' && candidate.email?.status === 'SENT' ? 'EMAIL_SENT' : String(candidate.status || 'WAITING').toUpperCase();
  const reason = localizeAutomationFailure(candidate.failureReason || candidate.email?.failureReason || '');
  const recoveryId = `${candidate.examId}:${candidate.candidateId}`;
  const emailFailure = status === 'EMAIL_FAILED' || candidate.email?.status === 'FAILED';
  return <tr className="automation-candidate-row"><td>{candidate.organizationName || '조직 정보 없음'}</td><td>{candidate.updatedAt ? formatDate(candidate.updatedAt) : '-'}</td><td><strong>{candidate.candidateName || '응시자 정보 없음'}</strong><br /><span className="form-hint">{candidate.examTitle || '시험 정보 없음'}</span></td><td><span className={`ai-request-status automation-${status.toLowerCase()}`}>{statusLabel[status] ?? status}</span>{reason && <><br /><span className="form-error">{reason}</span></>}</td><td>{recoveryStatus(status) ? <button className={`${emailFailure ? 'secondary' : 'primary'}-button compact-button`} type="button" onClick={() => onRecover(candidate)} disabled={acceptingId === recoveryId}>{acceptingId === recoveryId ? <LoaderCircle className="spin" size={14} /> : emailFailure ? <RefreshCw size={14} /> : <RotateCcw size={14} />} {emailFailure ? '메일 재발송' : '다시 채점'}</button> : <span className="form-hint">복구 작업 없음</span>}</td></tr>;
}
