import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api, authHeaders } from '../api/client';

export default function UserMgmtTab() {
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.get('/admin/candidates', { headers: authHeaders() })
      .then(({ data }) => setUsers(data))
      .catch(() => setLoadError('응시자 목록을 불러오지 못했습니다. 다시 로그인한 뒤 시도해주세요.'));
  }, []);

  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: '10px', color: '#d97706' }}>
          <Users size={24} />
        </div>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>전체 응시자 및 결과 조회</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>전체 조직의 응시자, 응시번호, 시험 배정과 결과 상태를 조회합니다.</p>
        </div>
      </div>
      {loadError && <div className="alert-box alert-error">{loadError}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>응시자 이름</th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>이메일</th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>조직</th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>응시번호</th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>상태</th>
              <th style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>결과</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.7rem', fontWeight: 'bold' }}>{user.name}</td>
                <td style={{ padding: '0.7rem', color: '#64748b' }}>{user.email}</td>
                <td style={{ padding: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>{user.organizationName}</td>
                <td style={{ padding: '0.7rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{user.candidateNumber}</td>
                <td style={{ padding: '0.7rem' }}><span className="badge-status badge-available">{user.approvalStatus === 'APPROVED' ? '승인 완료' : user.approvalStatus}</span></td>
                <td style={{ padding: '0.7rem' }}><span className="text-muted">{user.assignments?.length ? user.assignments.map((assignment) => `${assignment.examTitle}: ${assignment.score ?? '미응시'}`).join(', ') : '미배정'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
