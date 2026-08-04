import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const statusLabel = { COMPLETED: '생성 완료', FAILED: '생성 실패', BLOCKED: '조건 확인 필요' };
const kindLabel = { REFERENCE_ANSWER: '모범답안 생성', GRADING: 'AI 채점' };
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '-';

export default function AiInvocationLogsTab() {
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/ai-invocation-logs?limit=200', { headers: authHeaders() });
      setLogs(data);
      setMessage('');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI 요청 로그를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return <section className="workspace-shell">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">AI 요청 감사</span><h1>AI 프롬프트 및 응답 로그</h1><p>모범답안 생성에 사용된 요청 내용, AI 원본 응답과 실패 사유를 확인합니다.</p></div><button className="secondary-button" type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> 새로고침</button></div>
    {message && <div className="workspace-alert error">{message}</div>}
    <div className="data-panel ai-log-list"><div className="ai-log-list-heading"><strong>최근 요청</strong><span>{logs.length}건 · API 키는 기록하지 않습니다.</span></div>{loading ? <p className="empty-state">로그를 불러오는 중입니다.</p> : logs.length ? logs.map((log) => <button type="button" className="ai-log-row" key={log.id} onClick={() => setSelected(log)}><span className={`status-badge ${log.status === 'COMPLETED' ? 'approved' : log.status === 'FAILED' ? 'rejected' : 'pending'}`}>{log.kind === 'GRADING' && log.status === 'COMPLETED' ? '채점 완료' : statusLabel[log.status] ?? log.status}</span><span><strong>{kindLabel[log.kind] ?? log.kind} · {log.questionTitle || log.examId || '대상 정보 없음'}</strong><small>{log.actorName} · {log.provider} / {log.model} · {formatDate(log.createdAt)}</small></span><em>{log.durationMs}ms</em></button>) : <p className="empty-state">아직 기록된 AI 요청이 없습니다.</p>}</div>
    {selected && <div className="confirm-modal ai-log-modal" role="dialog" aria-modal="true" aria-labelledby="ai-log-title"><button className="confirm-modal-backdrop" type="button" aria-label="로그 닫기" onClick={() => setSelected(null)} /><section className="ai-log-detail"><header><div><span className="workspace-eyebrow"><Cpu size={14} /> {kindLabel[selected.kind] ?? selected.kind} · {selected.provider} · {selected.model}</span><h2 id="ai-log-title">{selected.questionTitle || selected.examId || 'AI 요청 상세'}</h2><p>{selected.connectionName} · {selected.actorName} · {formatDate(selected.createdAt)} · {selected.durationMs}ms</p></div><button className="icon-button" type="button" aria-label="로그 닫기" onClick={() => setSelected(null)}><X size={18} /></button></header>{selected.errorMessage && <div className="workspace-alert error">{selected.errorMessage}</div>}<section><h3>전송 프롬프트</h3><pre>{JSON.stringify(selected.prompt, null, 2)}</pre></section><section><h3>AI 원본 응답</h3><pre>{selected.response ? JSON.stringify(selected.response, null, 2) : '응답을 받기 전에 실패했습니다.'}</pre></section></section></div>}
  </section>;
}
