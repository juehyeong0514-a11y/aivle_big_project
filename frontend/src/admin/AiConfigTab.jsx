import React, { useEffect, useState } from 'react';
import { Cpu, Settings } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function AiConfigTab() {
  const [policies, setPolicies] = useState({ invitationExpiryHours: 24, aiAnalysisEnabled: true });
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/admin/policies', { headers: authHeaders() }).then(({ data }) => setPolicies(data)).catch((reason) => setMessage(apiErrorMessage(reason, 'AI 정책을 불러오지 못했습니다.'))); }, []);
  const save = async () => { try { const { data } = await api.patch('/admin/policies', policies, { headers: authHeaders() }); setPolicies(data); setMessage('AI 및 초대 정책을 저장했습니다.'); } catch (reason) { setMessage(apiErrorMessage(reason, '정책 저장에 실패했습니다.')); } };
  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">AI POLICY</span><h1>LLM 및 AI 분석 설정</h1><p>플랫폼 전체 초대 만료와 AI 분석 사용 정책을 관리합니다.</p></div><Cpu size={22} color="#7c3aed" /></div>{message && <div className="workspace-alert">{message}</div>}<div className="data-panel form-panel" style={{ maxWidth: 640 }}><label>초대 링크 만료 시간(시간)<input type="number" min="1" max="168" value={policies.invitationExpiryHours} onChange={(event) => setPolicies({ ...policies, invitationExpiryHours: Number(event.target.value) })} /></label><label className="toggle-row"><input type="checkbox" checked={policies.aiAnalysisEnabled} onChange={(event) => setPolicies({ ...policies, aiAnalysisEnabled: event.target.checked })} /> AI 분석 활성화</label><button className="primary-button" type="button" onClick={save}><Settings size={16} /> 설정 저장</button></div></section>;
}
