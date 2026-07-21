import React from 'react';
import { ShieldAlert, Save } from 'lucide-react';

export default function CheatMgmtTab() {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: '500' }}>
          <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
          <span>웹캠 시선 이탈 3회 이상 감지 시 자동 경고 발송</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: '500' }}>
          <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
          <span>이어폰 및 헤드셋 착용 탐지 시 즉시 부정행위 로그 기록</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: '500' }}>
          <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
          <span>브라우저 전체 화면 이탈(Tab Switch) 시 시험 강제 제출</span>
        </label>
        <button className="btn-primary" style={{ width: 'fit-content', marginTop: '1rem' }} onClick={() => alert('금지사항 정책이 저장되었습니다.')}>
          <Save size={16} style={{ marginRight: '6px' }} /> 정책 저장하기
        </button>
      </div>
    </div>
  );
}