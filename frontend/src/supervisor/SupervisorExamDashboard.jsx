import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, BookOpen, CalendarClock, CalendarDays, ClipboardList, MoreHorizontal, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, authHeaders } from '../api/client';
import { formatScheduleForApi, parseScheduleForForm, parseScheduleTimestamp } from '../manager/examSchedule.mjs';

const statusLabel = (status) => ({ AVAILABLE: '운영 예정', IN_PROGRESS: '운영 중', COMPLETED: '종료됨' }[status] ?? status);
const statusClass = (status) => ({ AVAILABLE: 'approved', IN_PROGRESS: 'active', COMPLETED: 'completed' }[status] ?? 'pending');
const examStatusAt = (exam, now) => {
  if (exam.status === 'COMPLETED') return 'COMPLETED';
  const startsAt = parseScheduleTimestamp(exam.date);
  if (startsAt === undefined) return exam.status;
  const durationMinutes = Number.parseInt(String(exam.duration ?? '').match(/\d+/)?.[0] ?? '', 10);
  const endsAt = Number.isFinite(durationMinutes) && durationMinutes > 0 ? startsAt + durationMinutes * 60 * 1000 : startsAt;
  return endsAt <= now ? 'COMPLETED' : exam.status;
};
const hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minuteOptions = Array.from({ length: 12 }, (_, minute) => String(minute * 5).padStart(2, '0'));

export default function SupervisorExamDashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('date-nearest');
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const [editSchedule, setEditSchedule] = useState({ date: '', hour: '10', minute: '00' });
  const [examToDelete, setExamToDelete] = useState(null);
  const [savingDate, setSavingDate] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState(null);

  useEffect(() => {
    api.get('/manager/exams', { headers: authHeaders() })
      .then(({ data }) => setExams(data))
      .catch((reason) => setError(apiErrorMessage(reason, '시험 목록을 불러오지 못했습니다.')));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const organizations = useMemo(() => [...new Map(exams.map((exam) => [exam.organizationId, exam.organizationName])).entries()], [exams]);
  const statusOptions = useMemo(() => [...new Set(exams.map((exam) => examStatusAt(exam, now)))], [exams, now]);
  const visibleExams = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredExams = exams.map((exam) => ({ ...exam, displayStatus: examStatusAt(exam, now) }))
      .filter((exam) => organizationId === 'ALL' || exam.organizationId === organizationId)
      .filter((exam) => status === 'ALL' || exam.displayStatus === status)
      .filter((exam) => !normalizedQuery || `${exam.title} ${exam.organizationName} ${exam.category ?? ''}`.toLowerCase().includes(normalizedQuery));
    if (sort === 'date-nearest') {
      return filteredExams.sort((left, right) => {
        const leftTimestamp = parseScheduleTimestamp(left.date);
        const rightTimestamp = parseScheduleTimestamp(right.date);
        if (leftTimestamp === undefined || rightTimestamp === undefined) {
          if (leftTimestamp === rightTimestamp) return left.title.localeCompare(right.title, 'ko');
          return leftTimestamp === undefined ? 1 : -1;
        }
        const leftUpcoming = leftTimestamp >= now;
        const rightUpcoming = rightTimestamp >= now;
        if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
        return leftUpcoming ? leftTimestamp - rightTimestamp : rightTimestamp - leftTimestamp;
      });
    }
    const [field, direction] = sort.split('-');
    return filteredExams.sort((left, right) => {
      const leftDate = parseScheduleTimestamp(left.date);
      const rightDate = parseScheduleTimestamp(right.date);
      if (field === 'date' && (leftDate === undefined || rightDate === undefined)) {
        if (leftDate === rightDate) return left.title.localeCompare(right.title, 'ko');
        return leftDate === undefined ? 1 : -1;
      }
      const leftValue = field === 'title' ? left.title : field === 'questions' ? Number(left.questionCount) : leftDate;
      const rightValue = field === 'title' ? right.title : field === 'questions' ? Number(right.questionCount) : rightDate;
      const comparison = typeof leftValue === 'number' ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue), 'ko');
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [exams, now, organizationId, query, sort, status]);

  const openDateEditor = (exam) => {
    setEditSchedule(parseScheduleForForm(exam.date));
    setEditingExam(exam);
    setOpenMenuId(null);
    setError('');
  };

  const saveExamDate = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const date = formatScheduleForApi(`${formData.get('date')}T${formData.get('hour')}:${formData.get('minute')}`);
    if (!date || !editingExam) {
      setError('시험 시작 일시를 올바르게 입력해주세요.');
      return;
    }
    setSavingDate(true);
    setError('');
    try {
      await api.patch(`/manager/exams/${editingExam.id}`, { date }, { headers: authHeaders() });
      const { data: refreshedExams } = await api.get('/manager/exams', { headers: authHeaders() });
      setExams(refreshedExams);
      setEditingExam(null);
      setMessage('시험 일정과 연결된 초대 링크 만료 시각이 함께 수정되었습니다.');
    } catch (reason) {
      setError(apiErrorMessage(reason, '시험 일정을 수정하지 못했습니다.'));
    } finally {
      setSavingDate(false);
    }
  };

  const deleteExam = async () => {
    if (!examToDelete) return;
    setDeletingExamId(examToDelete.id);
    setError('');
    try {
      await api.delete(`/manager/exams/${examToDelete.id}`, { headers: authHeaders() });
      setExams((current) => current.filter((exam) => exam.id !== examToDelete.id));
      setMessage(`'${examToDelete.title}' 시험과 연결된 관리 데이터가 삭제되었습니다.`);
      setExamToDelete(null);
    } catch (reason) {
      setError(apiErrorMessage(reason, '시험을 삭제하지 못했습니다.'));
    } finally {
      setDeletingExamId(null);
    }
  };

  return <section className="workspace-shell supervisor-exam-dashboard">
    <div className="workspace-heading">
      <div><span className="workspace-eyebrow">SUPERVISOR EXAMS</span><h1>시험 총괄 대시보드</h1><p>담당 조직의 시험 운영 현황을 한곳에서 조회하고 관리합니다.</p></div>
      <button className="primary-button" type="button" onClick={() => navigate('/manager/exams/new')}><Plus size={17} /> 시험 생성</button>
    </div>
    {message && <div className="workspace-alert">{message}</div>}
    {error && <div className="workspace-alert error">{error}</div>}
    <section className="data-panel exam-dashboard-panel">
      <div className="exam-dashboard-toolbar">
        <div className="exam-search-area"><label htmlFor="exam-search">시험 찾기</label><div className="exam-search-input"><Search size={20} aria-hidden="true" /><input id="exam-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시험명, 조직명 또는 평가 유형을 입력하세요" autoComplete="off" />{query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={17} /></button>}</div><small>시험명·조직명·평가 유형으로 검색할 수 있습니다.</small></div>
        <div className="exam-filter-controls"><label>조직<select aria-label="조직 필터" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="ALL">전체 조직</option>{organizations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>상태<select aria-label="상태 필터" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">전체 상태</option>{statusOptions.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label><label className="exam-sort-control"><span><ArrowUpDown size={15} /> 정렬</span><select aria-label="정렬" value={sort} onChange={(event) => setSort(event.target.value)}><option value="date-nearest">일정 가장 빠른순</option><option value="date-desc">일정 최신순</option><option value="date-asc">일정 오래된순</option><option value="title-asc">시험명 가나다순</option><option value="questions-desc">문제 수 많은순</option></select></label></div>
      </div>
      <div className="exam-dashboard-summary"><ClipboardList size={16} /> {query ? <><strong>“{query}”</strong> 검색 결과</> : '표시 중인 시험'} <strong>{visibleExams.length}</strong>개</div>
      <div className="exam-card-grid">
        {visibleExams.map((exam) => <article className={`exam-summary-card${openMenuId === exam.id ? ' menu-open' : ''}`} key={exam.id}>
          <div className="exam-card-tools">
            <button className="icon-button exam-card-menu-trigger" type="button" aria-label={`${exam.title} 관리 메뉴`} aria-expanded={openMenuId === exam.id} onClick={() => setOpenMenuId((current) => current === exam.id ? null : exam.id)}><MoreHorizontal size={18} /></button>
            {openMenuId === exam.id && <div className="exam-card-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => openDateEditor(exam)}><Pencil size={15} /> 날짜 수정</button>
              <button className="exam-card-menu-danger" type="button" role="menuitem" onClick={() => { setExamToDelete(exam); setOpenMenuId(null); }}><Trash2 size={15} /> 시험 삭제</button>
            </div>}
          </div>
          <button className="exam-summary-card-main" type="button" onClick={() => navigate(`/manager/exams/${exam.id}`)} aria-label={`${exam.title} 상세 관리`}>
            <div className="exam-card-heading"><span className="exam-card-org">{exam.organizationName}</span><span className={`status-badge ${statusClass(exam.displayStatus)}`}>{statusLabel(exam.displayStatus)}</span></div>
            <h2>{exam.title}</h2><p>{exam.category ?? '정규 평가'}</p>
            <div className="exam-card-metrics"><span><CalendarDays size={15} /> {exam.date}</span><span><BookOpen size={15} /> 문제 {exam.questionCount ?? 0}개</span><span><Users size={15} /> 응시자 {exam.examineeCount ?? 0}명</span><span className="exam-card-duration">{exam.duration}</span></div>
          </button>
          <footer><button className="text-button" type="button" onClick={() => navigate(`/manager/exams/${exam.id}`)}>상세 관리</button></footer>
        </article>)}
      </div>
      {!visibleExams.length && <p className="empty-state">조건에 맞는 시험이 없습니다. 필터를 조정하거나 새 시험을 생성하세요.</p>}
    </section>
    {editingExam && <div className="exam-date-modal" role="dialog" aria-modal="true" aria-labelledby="exam-date-editor-title">
      <button className="exam-date-modal-backdrop" type="button" aria-label="시험 일정 수정 닫기" onClick={() => setEditingExam(null)} />
      <form className="exam-date-panel" onSubmit={saveExamDate}>
        <div className="exam-date-heading"><div><span className="workspace-eyebrow"><CalendarClock size={14} /> 시험 일정 수정</span><h2 id="exam-date-editor-title">{editingExam.title}</h2><p>시험 날짜를 바꾸면 기존 초대 링크의 시험 일정과 만료 시각도 함께 갱신됩니다.</p></div><button className="icon-button" type="button" aria-label="시험 일정 수정 닫기" onClick={() => setEditingExam(null)}><X size={18} /></button></div>
        <div className="schedule-picker-row">
          <label>날짜<input name="date" type="date" value={editSchedule.date} onChange={(event) => setEditSchedule({ ...editSchedule, date: event.target.value })} required /></label>
          <label>시<select name="hour" value={editSchedule.hour} onChange={(event) => setEditSchedule({ ...editSchedule, hour: event.target.value })}>{hourOptions.map((hour) => <option value={hour} key={hour}>{hour}</option>)}</select></label>
          <label>분<select name="minute" value={editSchedule.minute} onChange={(event) => setEditSchedule({ ...editSchedule, minute: event.target.value })}>{minuteOptions.map((minute) => <option value={minute} key={minute}>{minute}</option>)}</select></label>
        </div>
        <div className="exam-date-actions"><button className="secondary-button" type="button" onClick={() => setEditingExam(null)}>취소</button><button className="primary-button" type="submit" disabled={savingDate}>{savingDate ? '저장 중...' : '일정 저장'}</button></div>
      </form>
    </div>}
    {examToDelete && <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="exam-delete-title">
      <button className="confirm-modal-backdrop" type="button" aria-label="시험 삭제 확인 닫기" onClick={() => setExamToDelete(null)} />
      <div className="confirm-modal-panel"><h2 id="exam-delete-title">시험을 삭제할까요?</h2><p><strong>{examToDelete.title}</strong> 시험과 문제, 응시자 배정, 초대 링크, 응시 결과가 함께 삭제됩니다. 조직에 등록된 응시자 정보는 유지됩니다.</p><div className="confirm-modal-actions"><button className="secondary-button" type="button" onClick={() => setExamToDelete(null)}>취소</button><button className="danger-button" type="button" disabled={deletingExamId === examToDelete.id} onClick={deleteExam}>{deletingExamId === examToDelete.id ? '삭제 중...' : '시험 삭제'}</button></div></div>
    </div>}
  </section>;
}
