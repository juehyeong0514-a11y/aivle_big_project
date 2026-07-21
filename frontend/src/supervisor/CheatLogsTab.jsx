import React from 'react';
import { ShieldAlert, AlertTriangle, Clock, User } from 'lucide-react';

export default function CheatLogsTab() {
  const logs = [
    { id: 1, time: '14:22:10', name: '박개발', type: '이어폰/헤드셋 탐지', severity: 'HIGH', desc: '귀 부근 이어폰 형태의 객체가 감지되었습니다.' },
    { id: 2, time: '14:15:45', name: '이수험', type: '장시간 시선 이탈', severity: 'MEDIUM', desc: '화면 정면에서 시선이 10초 이상 벗어났습니다.' },
    { id: 3, time: '14:05:20', name: '이수험', type: '화면 이탈 (탭 전환)', severity: 'MEDIUM', desc: '브라우저 포커스가 해제되었습니다.' },
  ];

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <ShieldAlert size={24} color="#ef4444" />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>부정행위 감지 로그 타임라인</h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>AI 감독 엔진이 실시간 수집한 이상 행동 리포트입니다.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {logs.map((log) => (
          <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '10px', backgroundColor: log.severity === 'HIGH' ? '#fee2e2' : '#fef3c7', color: log.severity === 'HIGH' ? '#dc2626' : '#d97706', borderRadius: '8px' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{log.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{log.time}</span>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: log.severity === 'HIGH' ? '#dc2626' : '#d97706' }}>{log.type}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{log.desc}</div>
              </div>
            </div>
            <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => alert(`[ID: ${log.id}] 당시 녹화 영상 단면 재생`)}>
              영상 기록 보기
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}