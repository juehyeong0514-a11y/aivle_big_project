import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';
import { filterInvocationLogs, localizeAutomationFailure, paginateInvocationLogs } from '../automationUi.mjs';

const statusLabel = { COMPLETED: '생성 완료', FAILED: '호출 실패', BLOCKED: '조건 확인 필요', PROCESSING: '호출 중', FINALIZING: '응시 마감 처리 중', EMAIL_FAILED: '결과 메일 실패', GRADING_FAILED: 'AI 채점 실패' };
const kindLabel = { REFERENCE_ANSWER: '모범답안 생성', GRADING: 'AI 채점' };
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '-';
const asList = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.logs) ? payload.logs : Array.isArray(payload?.items) ? payload.items : []);
const effectiveStatus = (log) => String(log?.status || 'UNKNOWN').toUpperCase();

export default function AiInvocationLogsTab() {
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [allMessage, setAllMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [allLoading, setAllLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [allPage, setAllPage] = useState(1);
  const [allStatus, setAllStatus] = useState('ALL');
  const [allQuery, setAllQuery] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/ai-invocation-logs?limit=20', { headers: authHeaders() });
      setLogs(asList(data).slice(0, 20));
      setMessage('');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI 호출 기록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };
  const loadAll = async () => {
    setAllLoading(true);
    try {
      const { data } = await api.get('/admin/ai-invocation-logs?limit=500', { headers: authHeaders() });
      setAllLogs(asList(data).slice(0, 500));
      setAllPage(1);
      setShowAll(true);
      setAllMessage('');
    } catch (error) {
      setAllMessage(apiErrorMessage(error, '전체 AI 호출 기록을 불러오지 못했습니다.'));
    } finally {
      setAllLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setAllPage(1); }, [allStatus, allQuery]);
  const filteredAllLogs = filterInvocationLogs(allLogs, { status: allStatus, query: allQuery });
  const pagedAllLogs = paginateInvocationLogs(filteredAllLogs, allPage, 20);
  const openAllButton = <button className="secondary-button compact-button" type="button" onClick={loadAll} disabled={allLoading}>{allLoading ? '전체 기록 불러오는 중' : '전체 기록 보기'}</button>;

  return <section className="workspace-shell">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">AI 호출 감사</span><h1>AI 호출 기록</h1><p>실제 AI 호출의 프롬프트, 원본 응답과 실패 사유를 최신 20건 기준으로 확인합니다.</p></div><div className="candidate-action-row"><button className="secondary-button" type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> 새로고침</button>{openAllButton}</div></div>
    {message && <div className="workspace-alert error">{message}</div>}
    <div className="data-panel ai-log-list"><div className="ai-log-list-heading"><strong>최신 AI 호출 20건</strong><span>{logs.length}건 표시 · API 키는 기록하지 않습니다.</span></div>{loading ? <p className="empty-state">호출 기록을 불러오는 중입니다.</p> : logs.length ? logs.map((log) => <InvocationLogRow key={log.id} log={log} onSelect={setSelected} />) : <p className="empty-state">아직 기록된 AI 호출이 없습니다.</p>}</div>
    {showAll && <section className="data-panel ai-log-history-panel"><div className="panel-heading ai-log-history-heading"><div><h2>전체 AI 호출 기록</h2><p>최대 500건을 최신순으로 불러오며, 한 페이지에 20건씩 표시합니다.</p></div><button className="secondary-button compact-button" type="button" onClick={() => setShowAll(false)}>전체 기록 닫기</button></div>{allMessage && <div className="workspace-alert error ai-log-history-alert">{allMessage}</div>}<div className="ai-log-history-filters"><label>상태<select value={allStatus} onChange={(event) => setAllStatus(event.target.value)}><option value="ALL">전체</option><option value="COMPLETED">성공</option><option value="FAILED">실패</option></select></label><label className="ai-log-history-search">응시자·시험 검색<input value={allQuery} onChange={(event) => setAllQuery(event.target.value)} placeholder="이름 또는 시험명" /></label><span className="ai-log-history-count">{pagedAllLogs.total}건</span></div>{pagedAllLogs.items.length ? <div className="ai-log-list ai-log-history-results">{pagedAllLogs.items.map((log) => <InvocationLogRow key={log.id} log={log} onSelect={setSelected} />)}</div> : <p className="empty-state ai-log-history-empty">검색 조건에 맞는 AI 호출 기록이 없습니다.</p>}<div className="candidate-action-row ai-log-history-pagination"><button className="secondary-button compact-button" type="button" onClick={() => setAllPage(pagedAllLogs.page - 1)} disabled={pagedAllLogs.page <= 1}>이전</button><span>{pagedAllLogs.page} / {pagedAllLogs.totalPages} 페이지 · 총 {pagedAllLogs.total}건</span><button className="secondary-button compact-button" type="button" onClick={() => setAllPage(pagedAllLogs.page + 1)} disabled={pagedAllLogs.page >= pagedAllLogs.totalPages}>다음</button></div></section>}
    {selected && <div className="confirm-modal ai-log-modal" role="dialog" aria-modal="true" aria-labelledby="ai-log-title"><button className="confirm-modal-backdrop" type="button" aria-label="호출 기록 닫기" onClick={() => setSelected(null)} /><section className="ai-log-detail"><header><div><span className="workspace-eyebrow"><Cpu size={14} /> {kindLabel[selected.kind] ?? selected.kind} · {selected.provider || '중앙 AI'} · {selected.model || '-'}</span><h2 id="ai-log-title">{selected.questionTitle || selected.examId || 'AI 호출 상세'}</h2><p>{selected.connectionName || 'AI 호출'} · {selected.actorName || '시스템'} · {formatDate(selected.createdAt)} · {selected.durationMs != null ? `${selected.durationMs}ms` : '-'}</p></div><button className="icon-button" type="button" aria-label="호출 기록 닫기" onClick={() => setSelected(null)}><X size={18} /></button></header>{(selected.automationFailureReason || selected.resultEmailFailureReason || selected.errorMessage) && <div className="workspace-alert error">{localizeAutomationFailure(selected.automationFailureReason || selected.resultEmailFailureReason || selected.errorMessage)}</div>}<section><h3>전송 프롬프트</h3><pre>{JSON.stringify(selected.prompt, null, 2)}</pre></section><section><h3>AI 원본 응답</h3><pre>{selected.response ? JSON.stringify(selected.response, null, 2) : '응답을 받기 전에 실패했습니다.'}</pre></section></section></div>}
  </section>;
}

function InvocationLogRow({ log, onSelect }) {
  const status = effectiveStatus(log);
  const reason = localizeAutomationFailure(log.automationFailureReason || log.resultEmailFailureReason || log.errorMessage);
  return <button type="button" className="ai-log-row" onClick={() => onSelect(log)}><span className={`status-badge ${status === 'COMPLETED' ? 'approved' : ['FAILED', 'GRADING_FAILED', 'EMAIL_FAILED'].includes(status) ? 'rejected' : 'pending'}`}>{log.kind === 'GRADING' && status === 'COMPLETED' ? '채점 완료' : statusLabel[status] ?? status}</span><span><strong>{kindLabel[log.kind] ?? log.kind} · {log.questionTitle || log.examId || '대상 정보 없음'}</strong><small>{log.actorName || '자동 처리'} · {log.provider || '중앙 AI'} / {log.model || '-'} · {formatDate(log.createdAt)}{reason ? ` · ${reason}` : ''}</small></span><em>{log.durationMs != null ? `${log.durationMs}ms` : '-'}</em></button>;
}
