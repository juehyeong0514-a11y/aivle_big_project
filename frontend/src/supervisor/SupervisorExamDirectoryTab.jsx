import React, { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ClipboardList } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function SupervisorExamDirectoryTab() {
  const [exams, setExams] = useState([]); const [error, setError] = useState('');
  useEffect(() => { api.get('/supervisor/exams', { headers: authHeaders() }).then(({ data }) => setExams(data)).catch((reason) => setError(apiErrorMessage(reason, '시험 목록을 불러오지 못했습니다.'))); }, []);
  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">시험 현황</span><h1>전체 시험 조회</h1><p>담당 조직에 배정된 전체 시험을 조회합니다.</p></div><div className="workspace-role-mark manager"><ClipboardList size={16} /> 감독관 조회</div></div>{error && <div className="workspace-alert error">{error}</div>}<div className="data-panel"><div className="panel-heading"><div><h2>배정된 시험</h2><p>시험 생성과 상세 운영은 시험 관리 메뉴에서 진행합니다.</p></div><BookOpen size={20} /></div><div className="admin-exam-list">{exams.map((exam) => <article className="admin-exam-row" key={exam.id}><div><strong>{exam.title}</strong><span>{exam.organizationName} · {exam.category}</span></div><div className="admin-exam-meta"><span><CalendarDays size={14} /> {exam.date}</span><span>응시자 {exam.examineeCount}명</span><span className="status-badge approved">{exam.status}</span></div></article>)}{!exams.length && <p className="empty-state">조회할 수 있는 시험이 없습니다.</p>}</div></div></section>;
}
