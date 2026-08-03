import React, { useEffect, useState } from 'react';
import { Save, ShieldAlert } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const defaultPolicies = {
  aiAnalysisEnabled: true,
  cheatDetection: { noPersonWarningEnabled: true, multiplePeopleWarningEnabled: true, cellPhoneWarningEnabled: true, bookWarningEnabled: false },
};

export default function CheatMgmtTab() {
  const [policies, setPolicies] = useState(defaultPolicies);
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/admin/policies', { headers: authHeaders() }).then(({ data }) => setPolicies(data)).catch((reason) => setMessage(apiErrorMessage(reason, 'AI 감지 정책을 불러오지 못했습니다.'))); }, []);
  const updateDetection = (key, value) => setPolicies((current) => ({ ...current, cheatDetection: { ...current.cheatDetection, [key]: value } }));
  const save = async () => { try { const { data } = await api.patch('/admin/policies', policies, { headers: authHeaders() }); setPolicies(data); setMessage('AI 감지 기본 정책을 저장했습니다.'); } catch (reason) { setMessage(apiErrorMessage(reason, 'AI 감지 정책 저장에 실패했습니다.')); } };
  const detectionDisabled = !policies.aiAnalysisEnabled;

  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '10px', color: '#dc2626' }}><ShieldAlert size={24} /></div>
        <div><h2 className="card-title" style={{ margin: 0 }}>AI 객체 감지 기본 정책</h2><p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>새 시험에 적용할 YOLO 분석 및 자동 경고 기본값을 설정합니다.</p></div>
      </div>
      {message && <div className="workspace-alert">{message}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label className="toggle-row"><input type="checkbox" checked={policies.aiAnalysisEnabled} onChange={(event) => setPolicies((current) => ({ ...current, aiAnalysisEnabled: event.target.checked }))} /> 웹캠 YOLO 객체 감지 활성화</label>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.noPersonWarningEnabled} onChange={(event) => updateDetection('noPersonWarningEnabled', event.target.checked)} /> 응시자 미감지 반복 시 자동 경고 기록</label>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.multiplePeopleWarningEnabled} onChange={(event) => updateDetection('multiplePeopleWarningEnabled', event.target.checked)} /> 여러 사람 반복 감지 시 자동 경고 기록</label>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.cellPhoneWarningEnabled} onChange={(event) => updateDetection('cellPhoneWarningEnabled', event.target.checked)} /> 휴대전화 반복 감지 시 자동 경고 기록</label>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.bookWarningEnabled} onChange={(event) => updateDetection('bookWarningEnabled', event.target.checked)} /> 책 반복 감지 시 자동 경고 기록</label>
        <button className="btn-primary" style={{ width: 'fit-content', marginTop: '1rem' }} onClick={save}><Save size={16} style={{ marginRight: '6px' }} /> 정책 저장하기</button>
      </div>
    </div>
  );
}
