import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Cpu, KeyRound, LoaderCircle, Play, Save, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const providerModels = {
  OpenAI: ['gpt-5.6', 'gpt-5.5', 'gpt-5.4', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-live', 'gpt-realtime'],
  Anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5', 'claude-opus-4.8', 'claude-sonnet-4.6', 'claude-haiku-4.5'],
  'Google Gemini': ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'],
  DeepSeek: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v3.2', 'deepseek-r1'],
  Cohere: ['command-a-plus', 'command-a', 'north-mini-code', 'rerank-4-pro', 'embed-4'],
  'Mistral AI': ['mistral-large-3', 'mistral-small-4', 'codestral', 'pixtral'],
  'Meta (Together AI, Groq 등)': ['llama-3.3', 'llama-3.2']
};

const statusLabel = { PENDING: '대기 중', PROCESSING: '채점 실행 중', COMPLETED: '완료', FAILED: '실패' };
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';

export default function AiConfigTab() {
  const [settings, setSettings] = useState({ provider: 'OpenAI', model: 'gpt-4o-mini', apiKeyConfigured: false, organizations: [] });
  const [requests, setRequests] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [keyCheck, setKeyCheck] = useState(null);
  const [checkingKey, setCheckingKey] = useState(false);
  const [acceptingId, setAcceptingId] = useState('');

  const loadRequests = useCallback(async () => {
    const { data } = await api.get('/admin/ai-grading-requests', { headers: authHeaders() });
    setRequests(data);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/admin/ai-settings', { headers: authHeaders() }),
      loadRequests()
    ]).then(([{ data }]) => setSettings(data))
      .catch((error) => setMessage(apiErrorMessage(error, 'AI 설정을 불러오지 못했습니다.')));
  }, [loadRequests]);

  useEffect(() => {
    if (!requests.some((request) => request.status === 'PROCESSING')) return undefined;
    const timer = window.setInterval(() => loadRequests().catch(() => {}), 4000);
    return () => window.clearInterval(timer);
  }, [loadRequests, requests]);

  const updateProvider = (provider) => {
    setSettings((current) => ({ ...current, provider, model: providerModels[provider][0] }));
    setKeyCheck(null);
  };

  const verifyKey = async () => {
    if (!apiKey.trim()) return setKeyCheck({ valid: false, message: '확인할 API 키를 입력하세요.' });
    setCheckingKey(true);
    setKeyCheck(null);
    try {
      const { data } = await api.post('/admin/ai-settings/verify-key', { provider: settings.provider, apiKey }, { headers: authHeaders() });
      setKeyCheck(data);
    } catch (error) {
      setKeyCheck({ valid: false, message: apiErrorMessage(error, 'API 키 확인에 실패했습니다.') });
    } finally {
      setCheckingKey(false);
    }
  };

  const save = async () => {
    try {
      const { data } = await api.patch('/admin/ai-settings', {
        provider: settings.provider,
        model: settings.model,
        ...(apiKey ? { apiKey } : {})
      }, { headers: authHeaders() });
      setSettings(data);
      setApiKey('');
      setKeyCheck(null);
      setMessage('중앙 AI 연결 설정을 저장했습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI 설정 저장에 실패했습니다.'));
    }
  };

  const acceptAndRun = async (requestId) => {
    setAcceptingId(requestId);
    try {
      const { data } = await api.post(`/admin/ai-grading-requests/${requestId}/accept`, {}, { headers: authHeaders() });
      setRequests((current) => current.map((item) => item.id === requestId ? data : item));
      setMessage('채점을 중앙 서버에서 실행했습니다. 완료 상태는 자동으로 갱신됩니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, '채점 실행 요청에 실패했습니다.'));
    } finally {
      setAcceptingId('');
    }
  };

  return <section className="workspace-shell">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">AI 운영 설정</span><h1>중앙 AI 채점 설정</h1><p>조직의 채점 요청을 관리자가 수락하면 중앙 API 키로 채점하고 결과를 조직에 전달합니다.</p></div><div className="workspace-role-mark admin"><Cpu size={16} /> 전체 운영 설정</div></div>
    {message && <div className="workspace-alert">{message}</div>}

    <div className="data-panel form-panel" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><KeyRound size={18} /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>API 설정</h2></div>
      <div className="form-grid"><label>AI 제공자<select value={settings.provider} onChange={(event) => updateProvider(event.target.value)}>{Object.keys(providerModels).map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></label><label>모델<select value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}>{(providerModels[settings.provider] ?? []).map((model) => <option key={model} value={model}>{model}</option>)}</select></label></div>
      <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>API 키<input type="password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setKeyCheck(null); }} placeholder={settings.apiKeyConfigured ? '새 키를 입력하면 기존 키를 교체합니다' : 'API 키를 입력하세요'} autoComplete="new-password" /></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}><button className="secondary-button" type="button" onClick={verifyKey} disabled={checkingKey}>{checkingKey ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} API 키 확인</button>{keyCheck && <span className={keyCheck.valid ? 'form-hint' : 'form-error'}>{keyCheck.message}</span>}</div>
      <p className="form-hint">검증에 사용한 키는 이 페이지에서만 일시적으로 사용되며, 저장 전에는 서버에 보관되지 않습니다.</p>
      <div className={`workspace-alert ${settings.apiKeyConfigured ? '' : 'warning'}`} style={{ marginTop: 12 }}><KeyRound size={16} /> {settings.apiKeyConfigured ? '중앙 API 키가 등록되어 있습니다.' : '등록된 중앙 API 키가 없습니다.'}</div>
      <button className="primary-button" type="button" onClick={save} style={{ marginTop: 12 }}><Save size={16} /> 설정 저장</button>
    </div>

    <div className="data-panel form-panel" style={{ maxWidth: 1000, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><ShieldCheck size={18} /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>조직별 이번 달 사용량</h2></div>
      <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>조직</th><th>이번 달 사용량</th></tr></thead><tbody>{settings.organizations.map((organization) => { const ratio = organization.monthlyLimit > 0 ? Math.min((organization.monthlyUsage / organization.monthlyLimit) * 100, 100) : 0; return <tr key={organization.organizationId}><td>{organization.organizationName}</td><td><div className="ai-quota-meter" role="progressbar" aria-label={`${organization.organizationName} 이번 달 AI 채점 사용량`} aria-valuenow={organization.monthlyUsage} aria-valuemin="0" aria-valuemax={organization.monthlyLimit}><div className="ai-quota-meter-track"><span style={{ width: `${ratio}%` }} /></div><div className="ai-quota-meter-label"><strong>{Math.round(ratio)}% 사용</strong><span>{organization.monthlyUsage}건 · {organization.usageMonth}</span></div></div></td></tr>; })}</tbody></table></div>
    </div>

    <div className="data-panel form-panel" style={{ maxWidth: 1000, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Cpu size={18} /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>AI 채점 요청 대기열</h2></div>
      <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>요청 조직</th><th>요청 일시</th><th>대상 응시자 / 시험</th><th>상태</th><th>관리</th></tr></thead><tbody>{requests.length === 0 ? <tr><td colSpan="5">대기 중인 AI 채점 요청이 없습니다.</td></tr> : requests.map((request) => <tr key={request.id}><td>{request.organizationName}</td><td>{formatDate(request.requestedAt)}</td><td><strong>{request.candidateName}</strong><br /><span className="form-hint">{request.examTitle}</span></td><td>{statusLabel[request.status] ?? request.status}{request.status === 'FAILED' && request.errorMessage ? <><br /><span className="form-error">{request.errorMessage}</span></> : null}</td><td>{request.status === 'PENDING' ? <button className="primary-button" type="button" onClick={() => acceptAndRun(request.id)} disabled={acceptingId === request.id}>{acceptingId === request.id ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />} 채점 수락 및 실행</button> : '-'}</td></tr>)}</tbody></table></div>
    </div>
  </section>;
}
