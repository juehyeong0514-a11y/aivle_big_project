import React, { useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function PolicyMgmtTab() {
  const [policies, setPolicies] = useState({ invitationExpiryHours: 24, aiAnalysisEnabled: true });
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/admin/policies', { headers: authHeaders() }).then(({ data }) => setPolicies(data)).catch((reason) => setMessage(apiErrorMessage(reason, '시험 정책을 불러오지 못했습니다.'))); }, []);
  const save = async () => { try { const { data } = await api.patch('/admin/policies', policies, { headers: authHeaders() }); setPolicies(data); setMessage('시험 운영 정책을 저장했습니다.'); } catch (reason) { setMessage(apiErrorMessage(reason, '시험 정책 저장에 실패했습니다.')); } };
  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '10px', color: '#16a34a' }}>
          <FileText size={24} />
        </div>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>문제 및 정책 관리</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>시험별 문제는 조직 관리자 시험 상세 화면에서 관리합니다.</p>
        </div>
      </div>
      {message && <div className="workspace-alert">{message}</div>}
      <div className="data-panel form-panel" style={{ maxWidth: 640 }}>
        <label>초대 링크 만료 시간(시간)<input type="number" min="1" max="168" value={policies.invitationExpiryHours} onChange={(event) => setPolicies({ ...policies, invitationExpiryHours: Number(event.target.value) })} /></label>
        <label className="toggle-row"><input type="checkbox" checked={policies.aiAnalysisEnabled} onChange={(event) => setPolicies({ ...policies, aiAnalysisEnabled: event.target.checked })} /> AI 분석 활성화</label>
        <button className="primary-button" type="button" onClick={save}><Save size={16} /> 정책 저장</button>
      </div>
    </div>
  );
}
