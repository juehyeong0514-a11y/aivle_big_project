import React from 'react';

export default function NoticeTab() {
  const notices = [
    { id: 1, title: '[필수 독려] 시험 응시 전 PC 크롬(Chrome) 브라우저 최신 업데이트 안내', date: '2026.07.18' },
    { id: 2, title: '보조 카메라(스마트폰) 거치 각도 및 QR 연결 가이드라인', date: '2026.07.15' }
  ];

  return (
    <div className="card" style={{ padding: 0 }}>
      {notices.map((n) => (
        <div key={n.id} className="notice-row" onClick={() => alert(`[공지] ${n.title}`)}>
          <span style={{ color: '#1e293b', fontWeight: '500' }}>{n.title}</span>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>{n.date}</span>
        </div>
      ))}
    </div>
  );
}