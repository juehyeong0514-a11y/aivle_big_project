import React from 'react';
import { Clock, Award, ArrowRight } from 'lucide-react';

export default function ExamTab({ onProtectedAction }) {
  const examList = [
    {
      id: 1,
      title: '2026년 하반기 신입 공채 AI 리터러시 역량 평가',
      category: '정규 평가 (Python / Java / C++)',
      duration: '90분',
      questions: '총 4문제',
      status: 'AVAILABLE',
      date: '2026.07.20 ~ 2026.07.22',
    }
  ];

  return (
    <div className="cards-grid">
      {examList.map((exam) => (
        <div key={exam.id} className="prog-card">
          <div className="prog-card-top">
            <span className="prog-category">{exam.category}</span>
            <span className="badge-status badge-available">응시 가능</span>
          </div>
          <h2 className="prog-title">{exam.title}</h2>
          <div className="prog-info-list">
            <div className="prog-info-item"><Clock size={16} color="#64748b" /><span>제한 시간: {exam.duration}</span></div>
            <div className="prog-info-item"><Award size={16} color="#64748b" /><span>문항 수: {exam.questions}</span></div>
          </div>
          <div className="prog-card-footer">
            <span className="prog-date">{exam.date}</span>
            <button className="prog-action-btn btn-blue" onClick={() => onProtectedAction('/exam/check')}>
              <span>시험 입장</span><ArrowRight size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}