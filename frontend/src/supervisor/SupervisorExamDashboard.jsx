import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, BookOpen, CalendarDays, ClipboardList, Plus, Search, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const statusLabel = (status) => ({ AVAILABLE: '운영 예정', IN_PROGRESS: '운영 중', COMPLETED: '종료' }[status] ?? status);

export default function SupervisorExamDashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [query, setQuery] = useState('');
  const [organizationId, setOrganizationId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('date-desc');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/manager/exams', { headers: authHeaders() })
      .then(({ data }) => setExams(data))
      .catch((reason) => setError(apiErrorMessage(reason, '시험 목록을 불러오지 못했습니다.')));
  }, []);

  const organizations = useMemo(() => [...new Map(exams.map((exam) => [exam.organizationId, exam.organizationName])).entries()], [exams]);
  const visibleExams = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const [field, direction] = sort.split('-');
    return exams
      .filter((exam) => organizationId === 'ALL' || exam.organizationId === organizationId)
      .filter((exam) => status === 'ALL' || exam.status === status)
      .filter((exam) => !normalizedQuery || `${exam.title} ${exam.organizationName} ${exam.category ?? ''}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftValue = field === 'title' ? left.title : field === 'questions' ? Number(left.questionCount) : String(left.date ?? '');
        const rightValue = field === 'title' ? right.title : field === 'questions' ? Number(right.questionCount) : String(right.date ?? '');
        const comparison = String(leftValue).localeCompare(String(rightValue), 'ko');
        return direction === 'asc' ? comparison : -comparison;
      });
  }, [exams, organizationId, query, sort, status]);

  return <section className="workspace-shell supervisor-exam-dashboard">
    <div className="workspace-heading">
      <div><span className="workspace-eyebrow">SUPERVISOR EXAMS</span><h1>시험 총괄 대시보드</h1><p>담당 조직의 시험 운영 현황을 한곳에서 조회하고 관리합니다.</p></div>
      <button className="primary-button" type="button" onClick={() => navigate('/manager/exams/new')}><Plus size={17} /> 시험 생성</button>
    </div>
    {error && <div className="workspace-alert error">{error}</div>}
    <section className="data-panel exam-dashboard-panel">
      <div className="exam-dashboard-toolbar">
        <div className="exam-search-area"><label htmlFor="exam-search">시험 찾기</label><div className="exam-search-input"><Search size={20} aria-hidden="true" /><input id="exam-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시험명, 조직명 또는 평가 유형을 입력하세요" autoComplete="off" />{query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={17} /></button>}</div><small>시험명·조직명·평가 유형으로 검색할 수 있습니다.</small></div>
        <div className="exam-filter-controls"><label>조직<select aria-label="조직 필터" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="ALL">전체 조직</option>{organizations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>상태<select aria-label="상태 필터" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">전체 상태</option>{[...new Set(exams.map((exam) => exam.status))].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label><label className="exam-sort-control"><span><ArrowUpDown size={15} /> 정렬</span><select aria-label="정렬" value={sort} onChange={(event) => setSort(event.target.value)}><option value="date-desc">일정 최신순</option><option value="date-asc">일정 오래된순</option><option value="title-asc">시험명 가나다순</option><option value="questions-desc">문제 수 많은순</option></select></label></div>
      </div>
      <div className="exam-dashboard-summary"><ClipboardList size={16} /> {query ? <><strong>“{query}”</strong> 검색 결과</> : '표시 중인 시험'} <strong>{visibleExams.length}</strong>개</div>
      <div className="exam-card-grid">
        {visibleExams.map((exam) => <article className="exam-summary-card" key={exam.id}>
          <button className="exam-summary-card-main" type="button" onClick={() => navigate(`/manager/exams/${exam.id}`)} aria-label={`${exam.title} 상세 관리`}>
            <div className="exam-card-heading"><span className="exam-card-org">{exam.organizationName}</span><span className="status-badge approved">{statusLabel(exam.status)}</span></div>
            <h2>{exam.title}</h2><p>{exam.category ?? '정규 평가'}</p>
            <div className="exam-card-metrics"><span><CalendarDays size={15} /> {exam.date}</span><span><BookOpen size={15} /> 문제 {exam.questionCount ?? 0}개</span><span><Users size={15} /> 응시자 {exam.examineeCount ?? 0}명</span></div>
          </button>
          <footer><span>{exam.duration}</span><button className="text-button" type="button" onClick={() => navigate(`/manager/exams/${exam.id}`)}>상세 관리</button></footer>
        </article>)}
      </div>
      {!visibleExams.length && <p className="empty-state">조건에 맞는 시험이 없습니다. 필터를 조정하거나 새 시험을 생성하세요.</p>}
    </section>
  </section>;
}
