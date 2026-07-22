import React, { useEffect, useState } from 'react';
import { Clock, Award, ArrowRight } from 'lucide-react';
import { api } from '../api/client';

export default function ExamTab({ onProtectedAction }) {
  const [examList, setExamList] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.get('/exams')
      .then(({ data }) => setExamList(data))
      .catch(() => setLoadError('시험 목록을 불러오지 못했습니다. 서버가 실행 중인지 확인해주세요.'));
  }, []);

  if (loadError) return <div className="alert-box alert-error">{loadError}</div>;

  return (
    <div className="cards-grid">
      {examList.map((exam) => (
        <div key={exam.id} className="prog-card">
          <div className="prog-card-top">
            <span className="prog-category">{exam.category}</span>
            <span className="badge-status badge-available">{exam.status === 'AVAILABLE' ? '응시 가능' : exam.status}</span>
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
