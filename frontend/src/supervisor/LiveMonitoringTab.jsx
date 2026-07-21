import React, { useState } from 'react';
import { Video, Monitor, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';

export default function LiveMonitoringTab() {
  const [examinees, setExaminees] = useState([
    { id: 1, name: '김응시', status: 'NORMAL', statusText: '정상 응시 중', currentProb: '문제 2번' },
    { id: 2, name: '이수험', status: 'WARNING', statusText: '시선 이탈 감지', currentProb: '문제 1번' },
    { id: 3, name: '박개발', status: 'DANGER', statusText: '이어폰 착용 의심', currentProb: '문제 3번' },
    { id: 4, name: '최코딩', status: 'NORMAL', statusText: '정상 응시 중', currentProb: '문제 4번 제출완료' },
  ]);

  const handleSendWarning = (name) => {
    const msg = prompt(`[${name}] 응시자에게 보낼 경고 메시지를 입력하세요:`);
    if (msg) alert(`[전송 완료] ${name}님에게 경고 전송됨: "${msg}"`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', margin: '0 0 0.5rem 0' }}>실시간 화상 관제실</h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>모든 응시자의 정면·측면 멀티캠 스트림과 AI 이상 행동 감지 상태를 실시간 모니터링합니다.</p>
        </div>
      </div>

      {/* 멀티캠 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {examinees.map((ex) => (
          <div key={ex.id} className="card" style={{ padding: '1rem', border: ex.status === 'DANGER' ? '2px solid #ef4444' : ex.status === 'WARNING' ? '2px solid #f59e0b' : '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#0f172a' }}>{ex.name} 응시자</span>
              <span style={{
                fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold',
                backgroundColor: ex.status === 'DANGER' ? '#fee2e2' : ex.status === 'WARNING' ? '#fef3c7' : '#dcfce7',
                color: ex.status === 'DANGER' ? '#dc2626' : ex.status === 'WARNING' ? '#d97706' : '#16a34a'
              }}>
                {ex.statusText}
              </span>
            </div>

            {/* 멀티캠 뷰 시뮬레이션 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', backgroundColor: '#0f172a', padding: '4px', borderRadius: '8px', marginBottom: '0.75rem', height: '130px' }}>
              <div style={{ backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', borderRadius: '4px', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 4, left: 4, fontSize: '0.65rem', color: '#38bdf8' }}>정면 웹캠</span>
                <Video size={24} />
              </div>
              <div style={{ backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', borderRadius: '4px', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 4, left: 4, fontSize: '0.65rem', color: '#a78bfa' }}>보조 스마트폰</span>
                <Monitor size={24} />
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem' }}>
              <div>진행 현황: <strong>{ex.currentProb}</strong></div>
            </div>

            <button
              className="btn-secondary"
              style={{ width: '100%', backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fda4af' }}
              onClick={() => handleSendWarning(ex.name)}
            >
              ⚠️ 경고 메시지 발송
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}