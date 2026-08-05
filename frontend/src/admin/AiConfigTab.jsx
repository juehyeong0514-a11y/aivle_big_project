import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cpu, KeyRound, LoaderCircle, Save, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const providerModels = {
  OpenAI: ['gpt-5.6', 'gpt-5.5', 'gpt-5.4', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gpt-live', 'gpt-realtime'],
  Anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5', 'claude-opus-4.8', 'claude-sonnet-4.6', 'claude-haiku-4.5'],
  'Google Gemini': ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'],
  DeepSeek: ['deepseek-v4-flash'],
  Cohere: ['command-a-plus', 'command-a', 'north-mini-code', 'rerank-4-pro', 'embed-4'],
  'Mistral AI': ['mistral-large-3', 'mistral-small-4', 'codestral', 'pixtral'],
  'Meta (Together AI, Groq 등)': ['llama-3.3', 'llama-3.2']
};

export default function AiConfigTab() {
  const [settings, setSettings] = useState({ provider: 'OpenAI', model: 'gpt-4o-mini', apiKeyConfigured: false, organizations: [] });
  const [apiKey, setApiKey] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [newProvider, setNewProvider] = useState('OpenAI');
  const [message, setMessage] = useState('');
  const [keyCheck, setKeyCheck] = useState(null);
  const [checkingKey, setCheckingKey] = useState(false);

  useEffect(() => {
    api.get('/admin/ai-settings', { headers: authHeaders() }).then(({ data }) => setSettings(data))
      .catch((error) => setMessage(apiErrorMessage(error, 'AI 설정을 불러오지 못했습니다.')));
  }, []);

  const updateProvider = (provider) => {
    setNewProvider(provider);
    setKeyCheck(null);
  };

  const verifyKey = async () => {
    if (!apiKey.trim()) return setKeyCheck({ valid: false, message: '확인할 API 키를 입력하세요.' });
    setCheckingKey(true);
    setKeyCheck(null);
    try {
      const { data } = await api.post('/admin/ai-settings/verify-key', { provider: newProvider, apiKey }, { headers: authHeaders() });
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
        model: settings.model
      }, { headers: authHeaders() });
      setSettings(data);
      setMessage('활성 AI 모델 설정을 저장했습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI 설정 저장에 실패했습니다.'));
    }
  };

  const registerConnection = async () => {
    if (!connectionName.trim() || !apiKey.trim()) return setKeyCheck({ valid: false, message: '연결 이름과 API 키를 입력하세요.' });
    try {
      const { data } = await api.post('/admin/ai-settings/connections', { name: connectionName, provider: newProvider, apiKey }, { headers: authHeaders() });
      setSettings(data);
      setConnectionName('');
      setApiKey('');
      setKeyCheck(null);
      setMessage('AI API 연결을 암호화하여 등록했습니다.');
    } catch (error) {
      setKeyCheck({ valid: false, message: apiErrorMessage(error, 'AI API 연결을 등록하지 못했습니다.') });
    }
  };

  const activateConnection = async (connection) => {
    try {
      const requestedModel = (providerModels[connection.provider] ?? [])[0];
      const { data } = await api.patch(`/admin/ai-settings/connections/${connection.id}/activate`, { model: connection.provider === settings.provider && (providerModels[connection.provider] ?? []).includes(settings.model) ? settings.model : requestedModel }, { headers: authHeaders() });
      setSettings(data);
      setKeyCheck(null);
      setMessage(`“${connection.name}” 연결을 현재 사용할 API로 설정했습니다.`);
    } catch (error) {
      setMessage(apiErrorMessage(error, '활성 AI 연결을 변경하지 못했습니다.'));
    }
  };

  const removeConnection = async (connection) => {
    if (!window.confirm(`“${connection.name}” API 연결을 삭제하시겠습니까?`)) return;
    try {
      const { data } = await api.delete(`/admin/ai-settings/connections/${connection.id}`, { headers: authHeaders() });
      setSettings(data);
      setMessage('AI API 연결을 삭제했습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI API 연결을 삭제하지 못했습니다.'));
    }
  };

  return <section className="workspace-shell">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">AI 운영 설정</span><h1>중앙 AI 채점 설정</h1><p>조직의 채점 요청을 관리자가 수락하면 중앙 API 키로 채점하고 결과를 조직에 전달합니다.</p></div><div className="workspace-role-mark admin"><Cpu size={16} /> 전체 운영 설정</div></div>
    {message && <div className="workspace-alert">{message}</div>}

    <div className="data-panel form-panel" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><KeyRound size={18} /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>API 설정</h2></div>
      <div className="form-grid"><label>연결 이름<input value={connectionName} onChange={(event) => setConnectionName(event.target.value)} placeholder="예: 운영용 OpenAI" /></label><label>AI 제공자<select value={newProvider} onChange={(event) => updateProvider(event.target.value)}>{Object.keys(providerModels).map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></label></div>
      <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>새 API 키<input type="password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setKeyCheck(null); }} placeholder="등록할 API 키를 입력하세요" autoComplete="new-password" /></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}><button className="secondary-button" type="button" onClick={verifyKey} disabled={checkingKey}>{checkingKey ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} API 키 확인</button>{keyCheck && <span className={keyCheck.valid ? 'form-hint' : 'form-error'}>{keyCheck.message}</span>}</div>
      <p className="form-hint">검증에 사용한 키는 이 페이지에서만 일시적으로 사용되며, 저장 전에는 서버에 보관되지 않습니다.</p>
      <button className="primary-button" type="button" onClick={registerConnection} style={{ marginTop: 12 }}><Save size={16} /> API 연결 등록</button>
      <div className="ai-connection-list"><div className="section-title-row"><h3>등록된 API 연결</h3><span className="form-hint">키는 끝 4자리만 표시됩니다.</span></div>{(settings.connections ?? []).length ? settings.connections.map((connection) => <article className={`ai-connection-card ${settings.activeConnectionId === connection.id ? 'active' : ''}`} key={connection.id}><div><strong>{connection.name}</strong><span>{connection.provider} · {connection.keyHint}</span></div><div>{settings.activeConnectionId === connection.id ? <span className="ai-connection-active">현재 사용 중</span> : <button className="secondary-button compact-button" type="button" onClick={() => activateConnection(connection)}>이 API 사용</button>}{!connection.readOnly && <button className="text-button" type="button" onClick={() => removeConnection(connection)}>삭제</button>}</div></article>) : <p className="empty-state">등록된 AI API 연결이 없습니다.</p>}</div>
      {settings.activeConnectionId && <div className="ai-active-model"><label>현재 연결에서 사용할 모델<select value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}>{(providerModels[settings.provider] ?? []).map((model) => <option key={model} value={model}>{model}</option>)}</select></label><button className="secondary-button" type="button" onClick={save}><Save size={16} /> 모델 저장</button></div>}
    </div>

    <div className="data-panel form-panel" style={{ maxWidth: 1000, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><ShieldCheck size={18} /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>조직별 이번 달 사용량</h2></div>
      <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>조직</th><th>이번 달 사용량</th></tr></thead><tbody>{settings.organizations.map((organization) => { const ratio = organization.monthlyLimit > 0 ? Math.min((organization.monthlyUsage / organization.monthlyLimit) * 100, 100) : 0; return <tr key={organization.organizationId}><td>{organization.organizationName}</td><td><div className="ai-quota-meter" role="progressbar" aria-label={`${organization.organizationName} 이번 달 AI 채점 사용량`} aria-valuenow={organization.monthlyUsage} aria-valuemin="0" aria-valuemax={organization.monthlyLimit}><div className="ai-quota-meter-track"><span style={{ width: `${ratio}%` }} /></div><div className="ai-quota-meter-label"><strong>{Math.round(ratio)}% 사용</strong><span>{organization.monthlyUsage}건 · {organization.usageMonth}</span></div></div></td></tr>; })}</tbody></table></div>
    </div>

  </section>;
}
