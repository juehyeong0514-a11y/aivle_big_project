import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function NoticeTab() {
  const [notices, setNotices] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.get('/notices')
      .then(({ data }) => setNotices(data))
      .catch(() => setLoadError('공지사항을 불러오지 못했습니다. 서버가 실행 중인지 확인해주세요.'));
  }, []);

  if (loadError) return <div className="alert-box alert-error">{loadError}</div>;

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
