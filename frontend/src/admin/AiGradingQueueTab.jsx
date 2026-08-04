import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, LoaderCircle, Pencil, Play, RefreshCw, RotateCcw, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const statusLabel = { PENDING: '대기 중', PROCESSING: '채점 실행 중', COMPLETED: '완료', FAILED: '실패' };
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';

export default function AiGradingQueueTab() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [acceptingId, setAcceptingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [instructionDraft, setInstructionDraft] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/ai-grading-requests', { headers: authHeaders() });
      setRequests(data);
      setMessage('');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI 채점 요청을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!requests.some((request) => request.status === 'PROCESSING')) return undefined;
    const timer = window.setInterval(() => load().catch(() => {}), 4000);
    return () => window.clearInterval(timer);
  }, [load, requests]);
  const acceptAndRun = async (requestId) => {
    setAcceptingId(requestId);
    try {
      const { data } = await api.post(`/admin/ai-grading-requests/${requestId}/accept`, {}, { headers: authHeaders() });
      setRequests((current) => current.map((item) => item.id === requestId ? data : item));
      setMessage('채점을 실행했습니다. 프롬프트와 AI 원본 응답은 AI 로그 페이지에 기록됩니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, '채점 실행 요청에 실패했습니다.'));
    } finally {
      setAcceptingId('');
    }
  };
  const retry = async (requestId) => {
    setAcceptingId(requestId);
    try {
      const { data } = await api.post(`/admin/ai-grading-requests/${requestId}/retry`, {}, { headers: authHeaders() });
      setRequests((current) => current.map((item) => item.id === requestId ? data : item));
      setMessage('다시 채점을 시작했습니다. 새 프롬프트와 응답은 AI 로그에 별도로 기록됩니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, '다시 채점하지 못했습니다.'));
    } finally {
      setAcceptingId('');
    }
  };
  const openEdit = (request) => { setEditing(request); setInstructionDraft(request.adminInstructions ?? ''); };
  const saveInstructions = async () => {
    try {
      const { data } = await api.patch(`/admin/ai-grading-requests/${editing.id}`, { adminInstructions: instructionDraft }, { headers: authHeaders() });
      setRequests((current) => current.map((item) => item.id === editing.id ? data : item));
      setEditing(null);
      setMessage('채점 보완 지시사항을 저장했습니다. 다음 실행부터 프롬프트에 포함됩니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, '채점 요청을 수정하지 못했습니다.'));
    }
  };
  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">AI 채점 운영</span><h1>AI 채점 요청 대기열</h1><p>조직에서 요청한 채점을 검토하고 중앙 AI 연결로 실행합니다.</p></div><button className="secondary-button" type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> 새로고침</button></div>{message && <div className="workspace-alert">{message}</div>}<div className="data-panel"><div className="panel-heading"><div><h2>채점 요청</h2><p>실행한 요청은 프롬프트·응답 로그에서 전체 내용을 확인할 수 있습니다.</p></div><Cpu size={20} /></div><div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>요청 조직</th><th>요청 일시</th><th>대상 응시자 / 시험</th><th>상태</th><th>관리</th></tr></thead><tbody>{requests.length === 0 ? <tr><td colSpan="5">{loading ? '요청을 불러오는 중입니다.' : '대기 중인 AI 채점 요청이 없습니다.'}</td></tr> : requests.map((request) => <tr key={request.id}><td>{request.organizationName}</td><td>{formatDate(request.requestedAt)}</td><td><strong>{request.candidateName}</strong><br /><span className="form-hint">{request.examTitle}</span>{request.adminInstructions && <><br /><span className="form-hint">보완 지시: {request.adminInstructions}</span></>}</td><td>{statusLabel[request.status] ?? request.status}{request.retryCount ? ` · 재시도 ${request.retryCount}회` : ''}{request.status === 'FAILED' && request.errorMessage ? <><br /><span className="form-error">{request.errorMessage}</span></> : null}</td><td><div className="ai-grading-row-actions"><button className="secondary-button compact-button" type="button" onClick={() => openEdit(request)} disabled={request.status === 'PROCESSING'}><Pencil size={14} /> 수정</button>{request.status === 'PENDING' && <button className="primary-button compact-button" type="button" onClick={() => acceptAndRun(request.id)} disabled={acceptingId === request.id}>{acceptingId === request.id ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />} 채점 실행</button>}{['FAILED', 'COMPLETED'].includes(request.status) && <button className="primary-button compact-button" type="button" onClick={() => retry(request.id)} disabled={acceptingId === request.id}>{acceptingId === request.id ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} 다시 채점</button>}</div></td></tr>)}</tbody></table></div></div>{editing && <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="grading-edit-title"><button className="confirm-modal-backdrop" type="button" aria-label="수정 닫기" onClick={() => setEditing(null)} /><section className="confirm-modal-panel ai-grading-edit"><div className="section-title-row"><div><h2 id="grading-edit-title">채점 요청 수정</h2><p>{editing.candidateName} · {editing.examTitle}</p></div><button className="icon-button" type="button" aria-label="수정 닫기" onClick={() => setEditing(null)}><X size={18} /></button></div><label>관리자 보완 지시사항 <span className="text-muted">(선택)</span><textarea value={instructionDraft} maxLength="4000" onChange={(event) => setInstructionDraft(event.target.value)} placeholder="예: 시간복잡도와 경계값 처리 여부를 특히 엄격하게 평가하세요." /></label><p className="form-hint">다음 채점 실행 또는 다시 채점할 때 AI 프롬프트에 포함됩니다. {instructionDraft.length}/4000</p><div className="confirm-modal-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>취소</button><button className="primary-button" type="button" onClick={saveInstructions}>저장</button></div></section></div>}</section>;
}
