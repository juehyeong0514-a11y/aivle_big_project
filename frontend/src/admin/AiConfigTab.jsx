import React, { useEffect, useState } from 'react';
import { Cpu, KeyRound, Save, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const providerModels = {
  OpenAI: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'],
  Anthropic: ['claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest'],
  'Google Gemini': ['gemini-2.0-flash', 'gemini-2.5-flash']
};

export default function AiConfigTab() {
  const [settings, setSettings] = useState({ provider: '', model: '', apiKeyConfigured: false, organizations: [] });
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    api.get('/admin/ai-settings', { headers: authHeaders() })
      .then(({ data }) => setSettings(data))
      .catch((error) => setMessage(apiErrorMessage(error, 'AI 설정을 불러오지 못했습니다.')));
  }, []);
  const updateOrganization = (organizationId, patch) => setSettings((current) => ({
    ...current,
    organizations: current.organizations.map((organization) => organization.organizationId === organizationId ? { ...organization, ...patch } : organization)
  }));
  const updateProvider = (provider) => setSettings((current) => ({ ...current, provider, model: providerModels[provider][0] }));
  const save = async () => {
    try {
      const { data } = await api.patch('/admin/ai-settings', {
        provider: settings.provider,
        model: settings.model,
        ...(apiKey ? { apiKey } : {}),
        organizations: settings.organizations.map(({ organizationId, enabled, monthlyLimit }) => ({ organizationId, enabled, monthlyLimit: Number(monthlyLimit) }))
      }, { headers: authHeaders() });
      setSettings(data);
      setApiKey('');
      setMessage('API 적용, 권한, 한도 설정을 저장했습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI 설정 저장에 실패했습니다.'));
    }
  };
  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">AI 운영 설정</span><h1>API 적용, 권한, 한도 설정</h1><p>AI 제공자 연결 정보와 조직별 AI 분석 사용 권한 및 월간 한도를 관리합니다.</p></div><div className="workspace-role-mark admin"><Cpu size={16} /> 전체 운영 설정</div></div>{message && <div className="workspace-alert">{message}</div>}<div className="data-panel form-panel" style={{ maxWidth: 900 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><KeyRound size={18} /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>API 적용</h2></div><div className="form-grid"><label>AI 제공자<select value={settings.provider} onChange={(event) => updateProvider(event.target.value)}>{Object.keys(providerModels).map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></label><label>모델<select value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })}>{(providerModels[settings.provider] ?? []).map((model) => <option key={model} value={model}>{model}</option>)}</select></label></div><label style={{ display: 'grid', gap: 6, marginTop: 12 }}>API 키<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.apiKeyConfigured ? '새 키를 입력하면 기존 키를 교체합니다' : 'API 키를 입력하세요'} autoComplete="new-password" /></label><p className="form-hint">API 키는 저장 시 암호화되며 이후 화면에 다시 표시되지 않습니다.</p><div className={`workspace-alert ${settings.apiKeyConfigured ? '' : 'warning'}`} style={{ marginTop: 12 }}><KeyRound size={16} /> {settings.apiKeyConfigured ? 'API 키가 등록되어 있습니다. 새 키를 입력하고 저장하면 교체됩니다.' : 'API 키가 등록되지 않았습니다. 키를 입력하려면 서버 환경변수 AI_SETTINGS_ENCRYPTION_KEY가 필요합니다.'}</div><p className="form-hint">이 화면은 연결 정보를 관리합니다. 실제 AI 분석 호출은 후속 기능에서 연결됩니다.</p></div><div className="data-panel form-panel" style={{ maxWidth: 900, marginTop: 20 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><ShieldCheck size={18} /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>조직별 권한 및 월간 한도</h2></div><div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>조직</th><th>AI 사용</th><th>월간 한도(건)</th><th>이번 달 사용량</th></tr></thead><tbody>{settings.organizations.map((organization) => { const ratio = organization.monthlyLimit > 0 ? Math.min((organization.monthlyUsage / organization.monthlyLimit) * 100, 100) : 0; return <tr key={organization.organizationId}><td>{organization.organizationName}</td><td><label className="toggle-row ai-org-toggle"><input type="checkbox" checked={organization.enabled} onChange={(event) => updateOrganization(organization.organizationId, { enabled: event.target.checked })} /> 허용</label></td><td><input aria-label={`${organization.organizationName} 월간 한도`} type="number" min="0" step="1" value={organization.monthlyLimit} onChange={(event) => updateOrganization(organization.organizationId, { monthlyLimit: event.target.value })} style={{ width: 120 }} /></td><td><div className="ai-quota-meter" role="progressbar" aria-label={`${organization.organizationName} 이번 달 AI 분석 사용량`} aria-valuenow={organization.monthlyUsage} aria-valuemin="0" aria-valuemax={organization.monthlyLimit}><div className="ai-quota-meter-track"><span style={{ width: `${ratio}%` }} /></div><div className="ai-quota-meter-label"><strong>{Math.round(ratio)}% 사용</strong><span>한도 {organization.monthlyLimit}건 · {organization.usageMonth}</span></div></div></td></tr>; })}</tbody></table></div><p className="form-hint">월간 한도 0은 분석 요청을 허용하지 않습니다. 향후 분석 요청 API에서 조직 권한과 한도를 자동 검증합니다.</p><button className="primary-button" type="button" onClick={save}><Save size={16} /> 설정 저장</button></div></section>;
}
