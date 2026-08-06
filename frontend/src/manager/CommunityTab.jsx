import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Edit3, MessageCircle, MessageSquare, Plus, Search, Trash2, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const emptyForm = { title: '', content: '', category: 'GENERAL', organizationId: '', examId: '', status: 'OPEN' };
const categoryLabels = { ALL: '전체', GENERAL: '자유', QUESTION: '질문', RESOURCE: '자료', SUGGESTION: '건의' };

export default function CommunityTab() {
  const isAdmin = localStorage.getItem('userRole') === 'ADMIN';
  const [posts, setPosts] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [exams, setExams] = useState([]);
  const [selected, setSelected] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [listOrganizationId, setListOrganizationId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [comment, setComment] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const composerTriggerRef = useRef(null);
  const composerReturnFocusRef = useRef(null);
  const composerReturnPostRef = useRef(null);

  const load = useCallback(async () => {
    if (isAdmin) {
      const { data } = await api.get('/admin/community', { headers: authHeaders() });
      setPosts(data);
      return;
    }
    const [postResult, organizationResult, examResult] = await Promise.all([
      api.get('/manager/community', { headers: authHeaders() }),
      api.get('/manager/organizations', { headers: authHeaders() }),
      api.get('/manager/exams', { headers: authHeaders() })
    ]);
    setPosts(postResult.data);
    const manageable = organizationResult.data.filter((item) => item.canManage !== false && item.status === 'APPROVED');
    setOrganizations(manageable);
    setExams(examResult.data);
    setForm((current) => ({ ...current, organizationId: current.organizationId || manageable[0]?.id || '' }));
    setListOrganizationId((current) => current || manageable[0]?.id || '');
  }, [isAdmin]);

  useEffect(() => {
    load().catch((reason) => setError(apiErrorMessage(reason, '커뮤니티를 불러오지 못했습니다.')));
  }, [load]);

  const filteredPosts = useMemo(() => posts.filter((post) =>
    (isAdmin || !listOrganizationId || post.organizationId === listOrganizationId)
    && (category === 'ALL' || post.category === category)
    && (!query.trim() || `${post.title} ${post.content} ${post.authorName}`.toLowerCase().includes(query.trim().toLowerCase()))
  ), [posts, query, category, isAdmin, listOrganizationId]);
  const filteredExams = exams.filter((exam) => exam.organizationId === form.organizationId);

  const openPost = async (post) => {
    if (isAdmin) return setSelected(post);
    try {
      const { data } = await api.get(`/manager/community/${post.id}`, { headers: authHeaders() });
      setSelected(data);
    } catch (reason) {
      setError(apiErrorMessage(reason, '게시글을 열지 못했습니다.'));
    }
  };
  const reset = () => {
    setEditingId('');
    setForm({ ...emptyForm, organizationId: organizations[0]?.id || '' });
  };
  const closeComposer = (restoreDetail = true) => {
    const returnPost = restoreDetail ? composerReturnPostRef.current : null;
    reset();
    setComposerOpen(false);
    composerReturnPostRef.current = null;
    if (returnPost) {
      setSelected(returnPost);
      window.requestAnimationFrame(() => document.querySelector(`[data-community-edit-post="${returnPost.id}"]`)?.focus());
      return;
    }
    window.requestAnimationFrame(() => composerReturnFocusRef.current?.focus());
  };
  const savePost = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (editingId) await api.patch(`/manager/community/${editingId}`, form, { headers: authHeaders() });
      else await api.post('/manager/community', form, { headers: authHeaders() });
      setMessage(editingId ? '게시글을 수정했습니다.' : '게시글을 등록했습니다.');
      reset();
      setSelected(null);
      closeComposer(false);
      await load();
    } catch (reason) {
      setError(apiErrorMessage(reason, '게시글을 저장하지 못했습니다.'));
    }
  };
  const editPost = (post, trigger) => {
    composerReturnFocusRef.current = trigger;
    composerReturnPostRef.current = post;
    setEditingId(post.id);
    setForm({ title: post.title, content: post.content, category: post.category, organizationId: post.organizationId, examId: post.examId || '', status: post.status });
    setSelected(null);
    setComposerOpen(true);
  };
  const removePost = async (post) => {
    if (!window.confirm(`"${post.title}" 게시글을 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`${isAdmin ? '/admin/community' : '/manager/community'}/${post.id}`, { headers: authHeaders() });
      setSelected(null);
      await load();
    } catch (reason) {
      setError(apiErrorMessage(reason, '게시글을 삭제하지 못했습니다.'));
    }
  };
  const addComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    try {
      await api.post(`/manager/community/${selected.id}/comments`, { content: comment }, { headers: authHeaders() });
      setComment('');
      await openPost(selected);
      await load();
    } catch (reason) {
      setError(apiErrorMessage(reason, '댓글을 등록하지 못했습니다.'));
    }
  };
  const removeComment = async (item) => {
    try {
      await api.delete(`/manager/community/${selected.id}/comments/${item.id}`, { headers: authHeaders() });
      await openPost(selected);
      await load();
    } catch (reason) {
      setError(apiErrorMessage(reason, '댓글을 삭제하지 못했습니다.'));
    }
  };

  return <section className="workspace-shell community-shell">
    <div className="workspace-heading">
      <div><span className="workspace-eyebrow">ORGANIZATION COMMUNITY</span><h1>조직 커뮤니티</h1><p>{isAdmin ? '전체 조직의 게시글을 확인하고 운영 정책에 따라 관리합니다.' : '배정된 조직 구성원과 질문, 자료, 건의사항을 공유합니다.'}</p></div>
      <div className={`workspace-role-mark ${isAdmin ? 'admin' : ''}`}><MessageSquare size={17} /> {isAdmin ? '전체 운영' : '조직 운영'}</div>
    </div>
    {message && <div className="workspace-alert">{message}</div>}
    {error && <div className="workspace-alert error">{error}</div>}

    {!isAdmin && composerOpen && <div className="community-modal-backdrop" onClick={closeComposer}><form className="community-modal form-panel community-form" role="dialog" aria-modal="true" aria-labelledby="community-composer-title" onKeyDown={(event) => { if (event.key === 'Escape') closeComposer(); }} onClick={(event) => event.stopPropagation()} onSubmit={savePost}>
      <div className="panel-heading"><div><h2 id="community-composer-title">{editingId ? '게시글 수정' : '새 게시글'}</h2><p>질문은 답변이 완료되면 해결 상태로 변경할 수 있습니다.</p></div><button type="button" className="icon-button" onClick={closeComposer} aria-label="게시글 작성 닫기"><X size={18} /></button></div>
      <div className="form-row">
        <label>조직<select required value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value, examId: '' })}><option value="">조직 선택</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>시험(선택)<select value={form.examId} onChange={(event) => setForm({ ...form, examId: event.target.value })}><option value="">조직 전체</option>{filteredExams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label>
        <label>분류<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{Object.entries(categoryLabels).filter(([key]) => key !== 'ALL').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <label>제목<input autoFocus required maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>내용<textarea required rows="6" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
      {editingId && form.category === 'QUESTION' && <label>질문 상태<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="OPEN">답변 대기</option><option value="RESOLVED">해결 완료</option></select></label>}
      <button className="primary-button" type="submit" disabled={!organizations.length}>{editingId ? '수정 저장' : '게시글 등록'}</button>
    </form></div>}

    <div className="data-panel">
      <div className="panel-heading"><div><h2>게시글</h2><p>총 {filteredPosts.length}개의 게시글</p></div><div className="organization-actions"><label className="notice-search compact"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·내용 검색" /></label>{!isAdmin && <><select value={listOrganizationId} onChange={(event) => setListOrganizationId(event.target.value)} aria-label="게시글 조직 선택">{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button ref={composerTriggerRef} type="button" className="primary-button" onClick={() => { composerReturnFocusRef.current = composerTriggerRef.current; reset(); setComposerOpen(true); }}><Plus size={16} /> 글쓰기</button></>}</div></div>
      <div className="community-filter-row">{Object.entries(categoryLabels).map(([key, label]) => <button key={key} type="button" className={category === key ? 'active' : ''} onClick={() => setCategory(key)}>{label}</button>)}</div>
      <div className="community-list">{filteredPosts.map((post) => <article key={post.id} className="community-row" onClick={() => openPost(post)}>
        <div><span className={`notice-category category-${post.category.toLowerCase()}`}>{categoryLabels[post.category]}</span>{post.status === 'RESOLVED' && <span className="community-resolved"><CheckCircle2 size={13} /> 해결</span>}<strong>{post.title}</strong><small>{post.organizationName}{post.examTitle ? ` · ${post.examTitle}` : ''} · {post.authorName} · {new Date(post.updatedAt).toLocaleDateString('ko-KR')}</small></div>
        <span><MessageCircle size={15} /> {post.commentCount}</span>
      </article>)}{!filteredPosts.length && <p className="empty-state">등록된 게시글이 없습니다.</p>}</div>
    </div>

    {selected && <div className="community-modal-backdrop" onClick={() => setSelected(null)}><article className="community-modal" onClick={(event) => event.stopPropagation()}>
      <button className="community-close" type="button" onClick={() => setSelected(null)}><X /></button>
      <span className={`notice-category category-${selected.category.toLowerCase()}`}>{categoryLabels[selected.category]}</span>
      <h2>{selected.title}</h2><small>{selected.organizationName}{selected.examTitle ? ` · ${selected.examTitle}` : ''} · {selected.authorName}</small>
      <p className="community-content">{selected.content}</p>
      <div className="community-actions">{!isAdmin && selected.canEdit && <button data-community-edit-post={selected.id} type="button" className="secondary-button" onClick={(event) => editPost(selected, event.currentTarget)}><Edit3 size={15} /> 수정</button>}{(isAdmin || selected.canEdit) && <button type="button" className="secondary-button danger" onClick={() => removePost(selected)}><Trash2 size={15} /> 삭제</button>}</div>
      {!isAdmin && <div className="community-comments"><h3>댓글 {selected.comments?.length || 0}</h3>{selected.comments?.map((item) => <div className="community-comment" key={item.id}><div><strong>{item.authorName}</strong><p>{item.content}</p></div>{item.canDelete && <button type="button" onClick={() => removeComment(item)}><Trash2 size={14} /></button>}</div>)}<form onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요" /><button className="primary-button">등록</button></form></div>}
    </article></div>}
  </section>;
}
