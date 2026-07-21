import React from 'react';
import { Users } from 'lucide-react';

export default function UserMgmtTab() {
  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: '10px', color: '#d97706' }}>
          <Users size={24} />
        </div>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>응시자 명단 및 권한 관리</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>시험 응시 대기자를 승인하고 실시간 접속 상태를 관리합니다.</p>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
              <th style={{ padding: '0.75rem' }}>응시자 이름</th>
              <th style={{ padding: '0.75rem' }}>이메일</th>
              <th style={{ padding: '0.75rem' }}>상태</th>
              <th style={{ padding: '0.75rem' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>홍길동</td>
              <td style={{ padding: '0.75rem', color: '#64748b' }}>applicant1@aivle.com</td>
              <td style={{ padding: '0.75rem' }}><span className="badge-status badge-available">승인 완료</span></td>
              <td style={{ padding: '0.75rem' }}><button className="prog-action-btn btn-outline-blue" onClick={() => alert('상태 변경')}>권한 수정</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}