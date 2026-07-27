import React, { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ClipboardList } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function AdminExamsTab() {
  const [exams, setExams] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/exams', { headers: authHeaders() })
      .then(({ data }) => setExams(data))
      .catch((reason) => setError(apiErrorMessage(reason, '등록된 시험을 불러오지 못했습니다.')));
  }, []);

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">ADMIN EXAM DIRECTORY</span><h1>전체 시험 관리</h1><p>플랫폼에 등록된 시험과 소속 조직, 문제 수를 통합 조회합니다.</p></div>
        <div className="workspace-role-mark admin"><ClipboardList size={20} /> 전체 조회</div>
      </div>
      {error && <div className="workspace-alert error">{error}</div>}
      <div className="data-panel">
        <div className="panel-heading"><div><h2>등록된 시험</h2><p>시험 생성과 문제 관리는 배정된 조직의 관리자 화면에서 진행합니다.</p></div><BookOpen size={20} /></div>
        <div className="admin-exam-list">
          {exams.map((exam) => <article className="admin-exam-row" key={exam.id}>
            <div><strong>{exam.title}</strong><span>{exam.organizationName} · {exam.category}</span></div>
            <div className="admin-exam-meta"><span><CalendarDays size={14} /> {exam.date}</span><span>{exam.questionCount || exam.questions}</span><span className="status-badge approved">{exam.status}</span></div>
          </article>)}
          {!exams.length && <p className="empty-state">등록된 시험이 없습니다.</p>}
        </div>
      </div>
    </section>
  );
}
