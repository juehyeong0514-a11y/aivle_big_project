import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const initialForm = { title: '', duration: '60분', questions: '총 10문제', date: '' };

export default function ManagerExamCreatePage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const approvedOrganizations = organizations.filter((organization) => organization.status === 'APPROVED' && organization.canManage);

  useEffect(() => {
    api.get('/manager/organizations', { headers: authHeaders() }).then(({ data }) => { setOrganizations(data); setOrganizationId(data.find((organization) => organization.status === 'APPROVED' && organization.canManage)?.id || ''); }).catch((reason) => setMessage(apiErrorMessage(reason, '승인 조직을 불러오지 못했습니다.')));
  }, []);

  const createExam = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post('/manager/exams', { ...form, organizationId }, { headers: authHeaders() });
      navigate(`/manager/exams/${data.id}`);
    } catch (reason) {
      setMessage(apiErrorMessage(reason, '시험 생성에 실패했습니다.'));
    }
  };

  return <section className="workspace-shell"><button className="back-link" type="button" onClick={() => navigate('/manager/exams')}><ArrowLeft size={16} /> 시험 목록으로</button><div className="workspace-heading"><div><span className="workspace-eyebrow">CREATE EXAM</span><h1>시험 생성</h1><p>시험 기본 정보와 일정을 입력한 뒤 상세 관리 화면으로 이동합니다.</p></div></div>{message && <div className="workspace-alert error">{message}</div>}<form className="data-panel form-panel create-exam-form" onSubmit={createExam}><label>작업 조직<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required><option value="">승인된 조직을 선택하세요</option>{approvedOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label>시험명<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><div className="form-row"><label>제한 시간<input value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required /></label><label>시험 일정<input value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} placeholder="2026.08.01 10:00" /></label></div><label>문항 수<input value={form.questions} onChange={(event) => setForm({ ...form, questions: event.target.value })} required /></label><button className="primary-button" type="submit" disabled={!organizationId}><Plus size={17} /> 시험 생성하고 상세 관리로 이동</button></form></section>;
}
