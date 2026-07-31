import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ChevronRight, Megaphone, Pin, Search, X } from 'lucide-react';
import { api, apiErrorMessage, candidateAuthHeaders } from '../api/client';

const categories = {
  ALL: '전체',
  GENERAL: '일반',
  EXAM: '시험 안내',
  MAINTENANCE: '점검',
  URGENT: '긴급',
};

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ko-KR');
};

export default function NoticeTab() {
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('inviteToken');
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError('');
      const hasCandidateSession = Boolean(localStorage.getItem('candidateAccessToken'));
      const request = hasCandidateSession
        ? api.get('/applicant/notices', { headers: candidateAuthHeaders() })
        : invitationToken
          ? api.get(`/invitations/${encodeURIComponent(invitationToken)}/notices`)
        : api.get('/notices', { params: { q: query.trim() || undefined, category } });
      request
        .then(({ data }) => setNotices(data.filter((notice) =>
          (category === 'ALL' || notice.category === category)
          && (!query.trim() || `${notice.title} ${notice.content}`.toLowerCase().includes(query.trim().toLowerCase()))
        )))
        .catch((error) => setLoadError(apiErrorMessage(error, '공지사항을 불러오지 못했습니다.')))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, category, invitationToken]);

  const pinnedCount = useMemo(() => notices.filter((notice) => notice.pinned).length, [notices]);

  const openNotice = async (notice) => {
    try {
      const hasCandidateSession = Boolean(localStorage.getItem('candidateAccessToken'));
      const { data } = hasCandidateSession
        ? await api.get(`/applicant/notices/${notice.id}`, { headers: candidateAuthHeaders() })
        : invitationToken
          ? await api.get(`/invitations/${encodeURIComponent(invitationToken)}/notices/${notice.id}`)
          : await api.get(`/notices/${notice.id}`);
      setSelectedNotice(data);
      setNotices((current) => current.map((item) => item.id === data.id ? { ...item, viewCount: data.viewCount } : item));
    } catch (error) {
      setLoadError(apiErrorMessage(error, '공지사항 상세 내용을 불러오지 못했습니다.'));
    }
  };

  return (
    <section className="workspace-shell notice-page">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">NOTICE CENTER</span><h1>공지사항</h1><p>시험 일정, 시스템 점검과 중요한 운영 안내를 확인하세요.</p></div>
        <div className="workspace-role-mark manager"><Megaphone size={18} /> 중요 공지 {pinnedCount}건</div>
      </div>

      <div className="data-panel notice-toolbar">
        <label className="notice-search"><Search size={17} /><input aria-label="공지사항 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목 또는 내용 검색" /></label>
        <div className="notice-category-filter" aria-label="공지 분류">
          {Object.entries(categories).map(([value, label]) => <button className={category === value ? 'active' : ''} key={value} type="button" onClick={() => setCategory(value)}>{label}</button>)}
        </div>
      </div>

      {loadError && <div className="workspace-alert error"><AlertTriangle size={16} /> {loadError}</div>}
      <div className="data-panel notice-list-panel">
        {loading && <div className="workspace-loading">공지사항을 불러오는 중입니다...</div>}
        {!loading && notices.map((notice) => (
          <button className={`notice-list-item ${notice.pinned ? 'pinned' : ''}`} key={notice.id} type="button" onClick={() => openNotice(notice)}>
            <span className={`notice-category category-${notice.category.toLowerCase()}`}>{categories[notice.category] ?? '일반'}</span>
            <span className="notice-list-content"><strong>{notice.pinned && <Pin size={14} />} {notice.title}</strong><small><CalendarDays size={13} /> {formatDate(notice.publishedAt)} · 조회 {notice.viewCount}</small></span>
            <ChevronRight size={18} />
          </button>
        ))}
        {!loading && !notices.length && <div className="empty-state">검색 조건에 맞는 공지사항이 없습니다.</div>}
      </div>

      {selectedNotice && <div className="notice-modal" role="dialog" aria-modal="true" aria-labelledby="notice-detail-title">
        <button className="notice-modal-backdrop" type="button" aria-label="공지 상세 닫기" onClick={() => setSelectedNotice(null)} />
        <article className="notice-detail-card">
          <button className="icon-button notice-close" type="button" aria-label="공지 상세 닫기" onClick={() => setSelectedNotice(null)}><X size={19} /></button>
          <span className={`notice-category category-${selectedNotice.category.toLowerCase()}`}>{categories[selectedNotice.category] ?? '일반'}</span>
          <h2 id="notice-detail-title">{selectedNotice.pinned && <Pin size={17} />} {selectedNotice.title}</h2>
          <p className="notice-detail-meta">{formatDate(selectedNotice.publishedAt)} · 조회 {selectedNotice.viewCount}</p>
          <div className="notice-detail-content">{selectedNotice.content || '등록된 상세 내용이 없습니다.'}</div>
        </article>
      </div>}
    </section>
  );
}
