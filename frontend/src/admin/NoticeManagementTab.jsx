import React, { useEffect, useState } from 'react';
import { Edit3, Megaphone, Pin, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const emptyForm = { title: '', content: '', category: 'GENERAL', pinned: false, publishStartAt: '', publishEndAt: '' };
const categoryLabels = { GENERAL: '일반', EXAM: '시험 안내', MAINTENANCE: '점검', URGENT: '긴급' };
const toLocalInput = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
const formatDate = (value) => value ? new Date(value).toLocaleString('ko-KR') : '즉시 게시';

export default function NoticeManagementTab() {
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/admin/notices', { headers: authHeaders() }).then(({ data }) => setNotices(data));
  useEffect(() => { load().catch((reason) => setError(apiErrorMessage(reason, '공지 목록을 불러오지 못했습니다.'))); }, []);

  const reset = () => { setEditingId(''); setForm(emptyForm); };
  const edit = (notice) => {
    setEditingId(notice.id);
    setForm({ title: notice.title, content: notice.content, category: notice.category, pinned: notice.pinned, publishStartAt: toLocalInput(notice.publishStartAt), publishEndAt: toLocalInput(notice.publishEndAt) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const payload = { ...form, publishStartAt: form.publishStartAt || null, publishEndAt: form.publishEndAt || null };
      if (editingId) await api.patch(`/admin/notices/${editingId}`, payload, { headers: authHeaders() });
      else await api.post('/admin/notices', payload, { headers: authHeaders() });
      setMessage(editingId ? '공지사항을 수정했습니다.' : '공지사항을 등록했습니다.');
      reset();
      await load();
    } catch (reason) {
      setError(apiErrorMessage(reason, '공지사항을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (notice) => {
    if (!window.confirm(`"${notice.title}" 공지를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/admin/notices/${notice.id}`, { headers: authHeaders() });
      if (editingId === notice.id) reset();
      setMessage('공지사항을 삭제했습니다.');
      await load();
    } catch (reason) {
      setError(apiErrorMessage(reason, '공지사항을 삭제하지 못했습니다.'));
    }
  };

  const visibleNotices = notices.filter((notice) => `${notice.title} ${notice.content}`.toLowerCase().includes(query.toLowerCase()));

  return <section className="workspace-shell">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">NOTICE MANAGEMENT</span><h1>공지사항 관리</h1><p>전체 사용자에게 노출할 공지를 등록하고 게시 기간과 중요도를 관리합니다.</p></div><div className="workspace-role-mark admin"><Megaphone size={17} /> ADMIN 전용</div></div>
    {message && <div className="workspace-alert">{message}</div>}
    {error && <div className="workspace-alert error">{error}</div>}

    <form className="data-panel form-panel notice-admin-form" onSubmit={save}>
      <div className="panel-heading"><div><h2>{editingId ? '공지 수정' : '새 공지 등록'}</h2><p>게시 기간을 비워두면 저장 즉시 계속 공개됩니다.</p></div>{editingId ? <button className="secondary-button" type="button" onClick={reset}><X size={15} /> 수정 취소</button> : <Plus size={20} />}</div>
      <label>제목<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} required /></label>
      <div className="form-row"><label>분류<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="toggle-row notice-pin-toggle"><input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} /><Pin size={15} /> 중요 공지로 상단 고정</label></div>
      <label>내용<textarea rows="8" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label>
      <div className="form-row"><label>게시 시작<input type="datetime-local" value={form.publishStartAt} onChange={(event) => setForm({ ...form, publishStartAt: event.target.value })} /></label><label>게시 종료<input type="datetime-local" value={form.publishEndAt} onChange={(event) => setForm({ ...form, publishEndAt: event.target.value })} /></label></div>
      <button className="primary-button" disabled={saving} type="submit"><Save size={16} /> {saving ? '저장 중...' : editingId ? '수정 사항 저장' : '공지 등록'}</button>
    </form>

    <div className="data-panel notice-admin-list">
      <div className="panel-heading"><div><h2>등록된 공지</h2><p>예약 및 종료된 공지도 ADMIN에게는 모두 표시됩니다.</p></div><label className="notice-search compact"><Search size={16} /><input aria-label="관리 공지 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="공지 검색" /></label></div>
      {visibleNotices.map((notice) => <article className="notice-admin-row" key={notice.id}><div><span className={`notice-category category-${notice.category.toLowerCase()}`}>{categoryLabels[notice.category]}</span><strong>{notice.pinned && <Pin size={13} />} {notice.title}</strong><small>{formatDate(notice.publishStartAt)} ~ {notice.publishEndAt ? formatDate(notice.publishEndAt) : '종료일 없음'} · 조회 {notice.viewCount}</small></div><div><button className="icon-action approve" type="button" title="수정" onClick={() => edit(notice)}><Edit3 size={16} /></button><button className="icon-action reject" type="button" title="삭제" onClick={() => remove(notice)}><Trash2 size={16} /></button></div></article>)}
      {!visibleNotices.length && <p className="empty-state">등록된 공지사항이 없습니다.</p>}
    </div>
  </section>;
}
