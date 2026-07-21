import React from 'react';
import { Clock } from 'lucide-react';

export default function PracticeTab({ onProtectedAction }) {
  const practiceList = [
    {
      id: 1,
      title: '[모의 테스트] 실시간 AI 감독 및 사전 장비 점검 체험',
      category: '환경 점검 및 WebRTC 통신 테스트',
      duration: '30분',
      desc: '실제 시험 응시 전에 웹캠, 화면 공유, QR 모바일 연동이 잘 되는지 미리 연습해보세요.',
    }
  ];

  return (
    <div className="cards-grid">
      {practiceList.map((practice) => (
        <div key={practice.id} className="prog-card">
          <div className="prog-card-top">
            <span className="prog-category">{practice.category}</span>
          </div>
          <h2 className="prog-title">{practice.title}</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', flex: 1 }}>{practice.desc}</p>
          <div className="prog-card-footer">
            <div className="prog-info-item"><Clock size={16} color="#64748b" /><span>{practice.duration}</span></div>
            <button className="prog-action-btn btn-outline-blue" onClick={() => onProtectedAction('/exam/check')}>
              <span>모의 연습 시작</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}