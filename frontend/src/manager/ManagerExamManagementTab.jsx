import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function ManagerExamManagementTab() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [exams, setExams] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState('');
  const approvedOrganizations = useMemo(() => organizations.filter((organization) => organization.status === 'APPROVED' && organization.canManage), [organizations]);
  const scopedExams = useMemo(() => exams.filter((exam) => exam.organizationId === organizationId), [exams, organizationId]);

  useEffect(() => {
    Promise.all([
      api.get('/manager/organizations', { headers: authHeaders() }),
      api.get('/manager/exams', { headers: authHeaders() }),
    ]).then(([organizationResponse, examResponse]) => {
      const approved = organizationResponse.data.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
      setOrganizations(organizationResponse.data);
      setExams(examResponse.data);
      setOrganizationId(approved[0]?.id || '');
    }).catch((reason) => setError(apiErrorMessage(reason, '시험 목록을 불러오지 못했습니다.')));
  }, []);

  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">EXAM MANAGEMENT</span><h1>시험 관리</h1><p>시험 목록을 확인하고 새 시험을 생성하거나 상세 관리 화면으로 이동합니다.</p></div><button className="primary-button" type="button" onClick={() => navigate('/manager/exams/new')}><Plus size={17} /> 시험 생성</button></div>{error && <div className="workspace-alert error">{error}</div>}<div className="data-panel organization-switcher"><label>작업 조직<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">승인된 조직을 선택하세요</option>{approvedOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><span>{approvedOrganizations.length ? '승인된 조직의 시험만 표시됩니다.' : 'ADMIN 승인 후 시험을 관리할 수 있습니다.'}</span></div><div className="data-panel"><div className="panel-heading"><div><h2>시험 목록</h2><p>시험을 클릭하면 문제·응시자·초대 관리 화면으로 이동합니다.</p></div><BookOpen size={20} /></div><div className="admin-exam-list">{scopedExams.map((exam) => <button className="admin-exam-row exam-list-link" type="button" key={exam.id} onClick={() => navigate(`/manager/exams/${exam.id}`)}><div><strong>{exam.title}</strong><span>{exam.date} · {exam.questionCount || 0}개 문제</span></div><div className="admin-exam-meta"><span><CalendarDays size={14} /> {exam.duration}</span><span className="status-badge approved">{exam.status}</span></div></button>)}{!scopedExams.length && <p className="empty-state">선택한 조직에 등록된 시험이 없습니다. 오른쪽 위의 시험 생성 버튼으로 시작하세요.</p>}</div></div></section>;
}
