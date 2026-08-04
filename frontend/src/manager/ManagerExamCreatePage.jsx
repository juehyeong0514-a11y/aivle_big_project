import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, authHeaders } from '../api/client';
import { calculateExamEndsAt, formatExamEndsAt, formatScheduleForApi } from './examSchedule.mjs';

const initialForm = { title: '', duration: '60', date: '', hour: '10', minute: '00' };
const hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minuteOptions = Array.from({ length: 12 }, (_, minute) => String(minute * 5).padStart(2, '0'));

export default function ManagerExamCreatePage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const approvedOrganizations = organizations.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
  const schedule = form.date ? `${form.date}T${form.hour}:${form.minute}` : '';
  const examEndsAt = useMemo(() => calculateExamEndsAt(schedule, form.duration), [schedule, form.duration]);

  useEffect(() => {
    api.get('/manager/organizations', { headers: authHeaders() }).then(({ data }) => {
      setOrganizations(data);
      setOrganizationId(data.find((organization) => organization.status === 'APPROVED' && organization.canManage)?.id || '');
    }).catch((reason) => setMessage(apiErrorMessage(reason, '승인 조직을 불러오지 못했습니다.')));
  }, []);

  const createExam = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post('/manager/exams', {
        ...form,
        duration: `${form.duration}분`,
        date: formatScheduleForApi(schedule),
        organizationId,
      }, { headers: authHeaders() });
      navigate(`/manager/exams/${data.id}`);
    } catch (reason) {
      setMessage(apiErrorMessage(reason, '시험 생성에 실패했습니다.'));
    }
  };

  return (
    <section className="workspace-shell">
      <button className="back-link" type="button" onClick={() => navigate('/manager/exams')}><ArrowLeft size={16} /> 시험 목록으로</button>
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">CREATE EXAM</span><h1>시험 생성</h1><p>시험 기본 정보와 일정을 입력한 뒤 상세 관리 화면으로 이동합니다.</p></div>
      </div>
      {message && <div className="workspace-alert error">{message}</div>}
      <form className="data-panel form-panel create-exam-form" onSubmit={createExam}>
        <label>작업 조직
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required>
            <option value="">승인된 조직을 선택하세요</option>
            {approvedOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>
        <label>시험명<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <div className="form-row">
          <div className="duration-field">
            <div className="schedule-fieldset-heading"><strong>제한 시간 (분)</strong></div>
            <label className="duration-control" htmlFor="exam-duration">
              <span className="duration-control-label">분 단위</span>
              <input id="exam-duration" type="number" min="1" step="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
            </label>
          </div>
          <section className="schedule-fieldset" aria-labelledby="exam-schedule-label">
            <div className="schedule-fieldset-heading">
              <strong id="exam-schedule-label">시험 시작 일시</strong>
            </div>
            <div className="schedule-picker-row">
              <label>날짜<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
              <label>시<select value={form.hour} onChange={(event) => setForm({ ...form, hour: event.target.value })}>{hourOptions.map((hour) => <option value={hour} key={hour}>{hour}</option>)}</select></label>
              <label>분<select value={form.minute} onChange={(event) => setForm({ ...form, minute: event.target.value })}>{minuteOptions.map((minute) => <option value={minute} key={minute}>{minute}</option>)}</select></label>
            </div>
            <span className="schedule-end-hint" aria-live="polite"><Clock3 size={14} /><span>{examEndsAt ? `예상 종료 ${formatExamEndsAt(examEndsAt)}` : '시작 일시와 제한 시간을 선택하면 종료 시각이 표시됩니다.'}</span></span>
          </section>
        </div>
        <button className="primary-button" type="submit" disabled={!organizationId}><Plus size={17} /> 시험 생성하고 상세 관리로 이동</button>
      </form>
    </section>
  );
}
