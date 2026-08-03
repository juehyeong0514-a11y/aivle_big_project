import React, { useEffect, useState } from 'react';
import { ShieldAlert, Save } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function CheatMgmtTab() {
  const [policies, setPolicies] = useState({ aiAnalysisEnabled: true, cheatDetection: { gazeWarningEnabled: true, audioDetectionEnabled: true, tabSwitchSubmitEnabled: true } });
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/admin/policies', { headers: authHeaders() }).then(({ data }) => setPolicies(data)).catch((reason) => setMessage(apiErrorMessage(reason, '부정행위 정책을 불러오지 못했습니다.'))); }, []);
  const updateDetection = (key, value) => setPolicies({ ...policies, cheatDetection: { ...policies.cheatDetection, [key]: value } });
  const save = async () => { try { const { data } = await api.patch('/admin/policies', policies, { headers: authHeaders() }); setPolicies(data); setMessage('부정행위 정책을 저장했습니다.'); } catch (reason) { setMessage(apiErrorMessage(reason, '부정행위 정책 저장에 실패했습니다.')); } };
  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '10px', color: '#dc2626' }}>
          <ShieldAlert size={24} />
        </div>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>부정행위 금지사항 정책 관리</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>실시간 AI 감독 시스템이 감지할 금지 항목과 제재 기준을 설정합니다.</p>
        </div>
      </div>
      {message && <div className="workspace-alert">{message}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: '500' }}>
          <input type="checkbox" checked={policies.cheatDetection.gazeWarningEnabled} onChange={(event) => updateDetection('gazeWarningEnabled', event.target.checked)} style={{ width: '18px', height: '18px' }} />
          <span>웹캠 시선 이탈 3회 이상 감지 시 자동 경고 발송</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: '500' }}>
          <input type="checkbox" checked={policies.cheatDetection.audioDetectionEnabled} onChange={(event) => updateDetection('audioDetectionEnabled', event.target.checked)} style={{ width: '18px', height: '18px' }} />
          <span>이어폰 및 헤드셋 착용 탐지 시 즉시 부정행위 로그 기록</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: '500' }}>
          <input type="checkbox" checked={policies.cheatDetection.tabSwitchSubmitEnabled} onChange={(event) => updateDetection('tabSwitchSubmitEnabled', event.target.checked)} style={{ width: '18px', height: '18px' }} />
          <span>브라우저 전체 화면 이탈(Tab Switch) 시 시험 강제 제출</span>
        </label>
        <button className="btn-primary" style={{ width: 'fit-content', marginTop: '1rem' }} onClick={save}>
          <Save size={16} style={{ marginRight: '6px' }} /> 정책 저장하기
        </button>
      </div>
    </div>
  );
}
