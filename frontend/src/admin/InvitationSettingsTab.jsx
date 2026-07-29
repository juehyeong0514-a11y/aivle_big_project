import React, { useEffect, useState } from 'react';
import { Link, Save } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function InvitationSettingsTab() {
  const [policies, setPolicies] = useState({ invitationExpiryHours: 24, aiAnalysisEnabled: true, cheatDetection: {} });
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/admin/policies', { headers: authHeaders() }).then(({ data }) => setPolicies(data)).catch((error) => setMessage(apiErrorMessage(error, '초대 설정을 불러오지 못했습니다.'))); }, []);
  const save = async () => { try { const { data } = await api.patch('/admin/policies', policies, { headers: authHeaders() }); setPolicies(data); setMessage('초대 링크 설정을 저장했습니다.'); } catch (error) { setMessage(apiErrorMessage(error, '초대 설정 저장에 실패했습니다.')); } };
  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">초대 설정</span><h1>초대 링크 설정</h1><p>플랫폼 전체에 적용될 기본 초대 링크 만료 시간을 관리합니다.</p></div><div className="workspace-role-mark admin"><Link size={16} /> 전체 운영 설정</div></div>{message && <div className="workspace-alert">{message}</div>}<div className="data-panel form-panel" style={{ maxWidth: 640 }}><label>초대 링크 만료 시간(시간)<input type="number" min="1" max="168" value={policies.invitationExpiryHours} onChange={(event) => setPolicies({ ...policies, invitationExpiryHours: Number(event.target.value) })} /></label><p className="form-hint">시험별 초대 링크 설정은 감독관의 시험 정책 관리에서 별도로 조정할 수 있습니다.</p><button className="primary-button" type="button" onClick={save}><Save size={16} /> 설정 저장</button></div></section>;
}
