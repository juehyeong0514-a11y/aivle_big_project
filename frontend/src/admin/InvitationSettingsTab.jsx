import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Clock3, FileWarning, LockKeyhole, RefreshCw, Save, Send, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const defaultPolicies = {
  aiAnalysisEnabled: true,
  cheatDetection: {},
  invitationSecurity: { revokePreviousOnResend: true, blockAfterSubmission: true, maxVerificationAttempts: 5, verificationLockoutMinutes: 15 },
};
const statusLabels = { ACTIVE: '활성', EXPIRED: '만료', REVOKED: '폐기', SUBMITTED: '제출 완료' };
const deliveryLabels = { SENT: '발송 완료', PREVIEW: '미리보기', PENDING: '처리 중', FAILED: '발송 실패' };
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';

export default function InvitationSettingsTab() {
  const [policies, setPolicies] = useState(defaultPolicies);
  const [overview, setOverview] = useState({ metrics: {}, warnings: [], organizationStats: [], filterOptions: { organizations: [], exams: [] } });
  const [invitations, setInvitations] = useState([]);
  const [audits, setAudits] = useState([]);
  const [filters, setFilters] = useState({ status: '', query: '', organizationId: '', examId: '', sentFrom: '', sentTo: '', expiringSoon: false });
  const [message, setMessage] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [busy, setBusy] = useState(false);
  const headers = useMemo(() => ({ headers: authHeaders() }), []);

  const load = async () => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.query.trim()) params.set('query', filters.query.trim());
    if (filters.organizationId) params.set('organizationId', filters.organizationId);
    if (filters.examId) params.set('examId', filters.examId);
    if (filters.sentFrom) params.set('sentFrom', filters.sentFrom);
    if (filters.sentTo) params.set('sentTo', filters.sentTo);
    if (filters.expiringSoon) params.set('expiringSoon', 'true');
    const suffix = params.size ? `?${params}` : '';
    const [policyResponse, overviewResponse, invitationResponse, auditResponse] = await Promise.all([
      api.get('/admin/policies', headers), api.get('/admin/invitations/overview', headers), api.get(`/admin/invitations${suffix}`, headers), api.get('/admin/invitation-audit-logs', headers),
    ]);
    setPolicies({ ...defaultPolicies, ...policyResponse.data, invitationSecurity: { ...defaultPolicies.invitationSecurity, ...(policyResponse.data.invitationSecurity || {}) } });
    setOverview(overviewResponse.data);
    setInvitations(invitationResponse.data);
    setAudits(auditResponse.data);
  };

  useEffect(() => { load().catch((error) => setMessage(apiErrorMessage(error, '초대 링크 운영 정보를 불러오지 못했습니다.'))); }, [filters.status, filters.query, filters.organizationId, filters.examId, filters.sentFrom, filters.sentTo, filters.expiringSoon]);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch('/admin/policies', { aiAnalysisEnabled: policies.aiAnalysisEnabled, cheatDetection: policies.cheatDetection, invitationSecurity: policies.invitationSecurity }, headers);
      setPolicies(data);
      setMessage('전역 초대 링크 보안 정책을 저장했습니다. 기존에 발급된 링크에는 영향을 주지 않습니다.');
      await load();
    } catch (error) { setMessage(apiErrorMessage(error, '초대 링크 정책 저장에 실패했습니다.')); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!revokeTarget || !revokeReason.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/invitations/${revokeTarget.id}/revoke`, { reason: revokeReason.trim() }, headers);
      setMessage(`${revokeTarget.candidateName}님의 초대 링크를 폐기했습니다.`);
      setRevokeTarget(null); setRevokeReason(''); await load();
    } catch (error) { setMessage(apiErrorMessage(error, '초대 링크를 폐기하지 못했습니다.')); }
    finally { setBusy(false); }
  };

  const updateSecurity = (key, value) => setPolicies((current) => ({ ...current, invitationSecurity: { ...current.invitationSecurity, [key]: value } }));
  const metricCards = [[overview.metrics.active ?? 0, '활성 링크', ShieldCheck], [overview.metrics.sentToday ?? 0, '오늘 발송', Send], [overview.metrics.expiringSoon ?? 0, '24시간 내 만료', Clock3], [overview.metrics.deliveryFailures ?? 0, '발송 실패', FileWarning]];

  return <section className="workspace-shell">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">INVITATION GOVERNANCE</span><h1>초대 링크 설정</h1><p>플랫폼 전역의 초대 정책, 보안 규칙, 발급 현황과 긴급 폐기를 관리합니다.</p></div><div className="workspace-role-mark admin"><ShieldCheck size={16} /> ADMIN 전용 운영</div></div>
    {message && <div className="workspace-alert">{message}</div>}
    <div className="metric-grid">{metricCards.map(([value, label, Icon]) => <div className="metric-card" key={label}><Icon size={17} /><strong>{value}</strong><span>{label}</span></div>)}</div>

    <div className="data-panel form-panel invitation-security-panel"><div className="panel-heading"><div><h2>보안 정책</h2><p>링크 만료는 각 시험의 설정과 시험 종료 시각으로 결정합니다. 링크 원문과 토큰 해시는 어떤 사용자에게도 표시하지 않습니다.</p></div><LockKeyhole size={20} /></div>
      <div className="invitation-security-options">
        <label className="toggle-row"><input type="checkbox" checked={policies.invitationSecurity.revokePreviousOnResend} onChange={(event) => updateSecurity('revokePreviousOnResend', event.target.checked)} /> 재발송 시 기존 미제출 링크 자동 폐기</label>
        <label className="toggle-row"><input type="checkbox" checked={policies.invitationSecurity.blockAfterSubmission} onChange={(event) => updateSecurity('blockAfterSubmission', event.target.checked)} /> 제출 완료 링크 차단</label>
      </div>
      <div className="form-row">
        <label>응시번호 검증 실패 허용 횟수<input type="number" min="1" max="10" value={policies.invitationSecurity.maxVerificationAttempts} onChange={(event) => updateSecurity('maxVerificationAttempts', Number(event.target.value))} /></label>
        <label>잠금 시간(분)<input type="number" min="1" max="1440" value={policies.invitationSecurity.verificationLockoutMinutes} onChange={(event) => updateSecurity('verificationLockoutMinutes', Number(event.target.value))} /></label>
      </div>
      <button className="primary-button" type="button" onClick={save} disabled={busy}><Save size={16} /> 보안 정책 저장</button>
    </div>

    {overview.warnings.length > 0 && <div className="workspace-alert error"><AlertTriangle size={16} /> <strong>운영 경고</strong>&nbsp; 발송 실패 또는 24시간 내 만료되는 링크가 {overview.warnings.length}건 있습니다.</div>}
    <div className="data-panel"><div className="panel-heading"><div><h2>전체 발급 현황</h2><p>발급 이력은 조회만 가능하며, 긴급 상황에서는 활성 링크만 폐기할 수 있습니다.</p></div><button className="secondary-button" type="button" onClick={() => load().catch(() => {})}><RefreshCw size={16} /> 새로고침</button></div>
      <div className="invitation-filter-bar"><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">전체 상태</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><label className="candidate-search-control"><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="조직, 시험, 응시자, 이메일 검색" /></label></div>
      <div className="invitation-filter-fields"><label>조직<select value={filters.organizationId} onChange={(event) => setFilters({ ...filters, organizationId: event.target.value, examId: '' })}><option value="">전체 조직</option>{overview.filterOptions.organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>시험<select value={filters.examId} onChange={(event) => setFilters({ ...filters, examId: event.target.value })}><option value="">전체 시험</option>{overview.filterOptions.exams.filter((item) => !filters.organizationId || item.organizationId === filters.organizationId).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>발송 시작일<input type="date" value={filters.sentFrom} onChange={(event) => setFilters({ ...filters, sentFrom: event.target.value })} /></label><label>발송 종료일<input type="date" value={filters.sentTo} onChange={(event) => setFilters({ ...filters, sentTo: event.target.value })} /></label></div>
      <label className="toggle-row invitation-expiring-toggle"><input type="checkbox" checked={filters.expiringSoon} onChange={(event) => setFilters({ ...filters, expiringSoon: event.target.checked })} /> 24시간 내 만료 링크만 보기</label>
      <div className="invitation-inventory-table"><table><thead><tr><th>조직 · 시험</th><th>응시자</th><th>발송/만료</th><th>상태</th><th>검증/제출</th><th>조치</th></tr></thead><tbody>{invitations.map((item) => <tr key={item.id}><td><strong>{item.organizationName}</strong><br /><span className="text-muted">{item.examTitle}</span></td><td>{item.candidateName}<br /><span className="text-muted">{item.candidateEmail}</span></td><td>{formatDate(item.sentAt)}<br /><span className={item.status === 'ACTIVE' && new Date(item.expiresAt).getTime() - Date.now() < 86400000 ? 'text-warning' : 'text-muted'}>{formatDate(item.expiresAt)}</span></td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span><br /><small className="text-muted">{deliveryLabels[item.deliveryStatus] || item.deliveryStatus}</small></td><td>{formatDate(item.verifiedAt)}<br />{formatDate(item.submittedAt)}</td><td>{item.status === 'ACTIVE' ? <button className="danger-button compact-button" type="button" onClick={() => setRevokeTarget(item)}><Ban size={14} /> 폐기</button> : '-'}</td></tr>)}{!invitations.length && <tr><td colSpan="6" className="empty-state">조건에 맞는 초대 링크가 없습니다.</td></tr>}</tbody></table></div>
    </div>
    <div className="workspace-grid two-columns" style={{ marginTop: 20 }}><div className="data-panel"><div className="panel-heading"><div><h2>조직별 발송 품질</h2><p>미검증 링크가 많은 조직은 담당 관리자에게 재발송을 요청하세요.</p></div></div>{overview.organizationStats.map((item) => <div className="organization-row" key={item.organizationId}><div><strong>{item.organizationName}</strong><span>발급 {item.invitationCount} · 활성 {item.activeCount} · 검증 {item.verifiedCount}</span></div><span className="status-badge pending">미검증 {item.unverifiedCount}</span></div>)}</div><div className="data-panel"><div className="panel-heading"><div><h2>감사 로그</h2><p>정책 변경과 ADMIN 긴급 폐기 이력을 최근 100건까지 보관합니다.</p></div></div>{audits.slice(0, 8).map((item) => <div className="organization-row" key={item.id}><div><strong>{item.action === 'POLICY_UPDATED' ? '전역 정책 변경' : '초대 링크 긴급 폐기'}</strong><span>{item.actorName} · {formatDate(item.createdAt)}{item.reason ? ` · ${item.reason}` : ''}</span></div></div>)}{!audits.length && <p className="empty-state">기록된 초대 링크 감사 로그가 없습니다.</p>}</div></div>
    {revokeTarget && <div className="monitoring-live-modal" role="dialog" aria-modal="true" aria-label="초대 링크 폐기 확인"><button className="monitoring-live-backdrop" type="button" onClick={() => setRevokeTarget(null)} /><div className="monitoring-live-panel" style={{ maxWidth: 520 }}><div className="monitoring-live-heading"><div><span className="workspace-eyebrow">IRREVERSIBLE ACTION</span><h2>초대 링크를 폐기할까요?</h2><p>{revokeTarget.candidateName} · {revokeTarget.examTitle}의 활성 링크가 즉시 차단됩니다. 이 작업은 되돌릴 수 없습니다.</p></div></div><label className="form-panel">폐기 사유<textarea value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} placeholder="예: 링크 유출 의심, 응시자 이메일 변경" autoFocus /></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}><button className="secondary-button" type="button" onClick={() => setRevokeTarget(null)}>취소</button><button className="danger-button" type="button" disabled={!revokeReason.trim() || busy} onClick={revoke}><Ban size={16} /> 폐기 확인</button></div></div></div>}
  </section>;
}
