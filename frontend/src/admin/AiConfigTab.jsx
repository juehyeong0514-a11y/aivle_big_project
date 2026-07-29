import React, { useEffect, useState } from 'react';
import { Cpu, Save } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function AiConfigTab() {
  const [policies, setPolicies] = useState({ invitationExpiryHours: 24, aiAnalysisEnabled: true, cheatDetection: {} });
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/admin/policies', { headers: authHeaders() }).then(({ data }) => setPolicies(data)).catch((error) => setMessage(apiErrorMessage(error, 'AI 설정을 불러오지 못했습니다.'))); }, []);
  const save = async () => { try { const { data } = await api.patch('/admin/policies', policies, { headers: authHeaders() }); setPolicies(data); setMessage('AI 분석 설정을 저장했습니다.'); } catch (error) { setMessage(apiErrorMessage(error, 'AI 분석 설정 저장에 실패했습니다.')); } };
  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">AI 분석 설정</span><h1>AI 분석 설정</h1><p>플랫폼 전체의 AI 분석 기능 사용 여부를 관리합니다.</p></div><div className="workspace-role-mark admin"><Cpu size={16} /> 전체 운영 설정</div></div>{message && <div className="workspace-alert">{message}</div>}<div className="data-panel form-panel" style={{ maxWidth: 640 }}><label className="toggle-row"><input type="checkbox" checked={policies.aiAnalysisEnabled} onChange={(event) => setPolicies({ ...policies, aiAnalysisEnabled: event.target.checked })} /> AI 분석 기능 사용</label><p className="form-hint">시험별 AI 분석 사용 여부는 감독관의 시험 정책 관리에서 조정할 수 있습니다.</p><button className="primary-button" type="button" onClick={save}><Save size={16} /> 설정 저장</button></div></section>;
}
