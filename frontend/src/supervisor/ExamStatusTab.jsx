import React from 'react';
import { Users, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function ExamStatusTab() {
  const statusList = [
    { id: 1, name: '김응시', email: 'applicant1@aivle.com', deviceCheck: '완료', examState: '응시 중', submitState: '미제출' },
    { id: 2, name: '이수험', email: 'applicant2@aivle.com', deviceCheck: '완료', examState: '응시 중', submitState: '미제출' },
    { id: 3, name: '박개발', email: 'applicant3@aivle.com', deviceCheck: '완료', examState: '응시 중', submitState: '미제출' },
    { id: 4, name: '최코딩', email: 'applicant4@aivle.com', deviceCheck: '완료', examState: '시험 종료', submitState: '제출 완료' },
  ];

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Users size={24} color="#2563EB" />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>응시자 접속 및 제출 현황</h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>현재 세션에 참여 중인 응시자의 장비 점검 및 답안 제출 상태를 조회합니다.</p>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
              <th style={{ padding: '0.75rem' }}>응시자 성명</th>
              <th style={{ padding: '0.75rem' }}>이메일</th>
              <th style={{ padding: '0.75rem' }}>사전 장비 점검</th>
              <th style={{ padding: '0.75rem' }}>시험 상태</th>
              <th style={{ padding: '0.75rem' }}>답안 제출 여부</th>
            </tr>
          </thead>
          <tbody>
            {statusList.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem 0.75rem', fontWeight: 'bold', color: '#0f172a' }}>{item.name}</td>
                <td style={{ padding: '1rem 0.75rem', color: '#64748b' }}>{item.email}</td>
                <td style={{ padding: '1rem 0.75rem' }}><span style={{ color: '#16a34a', fontWeight: '600' }}>{item.deviceCheck}</span></td>
                <td style={{ padding: '1rem 0.75rem' }}><span style={{ color: '#2563EB', fontWeight: '600' }}>{item.examState}</span></td>
                <td style={{ padding: '1rem 0.75rem' }}>
                  <span style={{
                    padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                    backgroundColor: item.submitState === '제출 완료' ? '#dcfce7' : '#f1f5f9',
                    color: item.submitState === '제출 완료' ? '#16a34a' : '#64748b'
                  }}>
                    {item.submitState}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}