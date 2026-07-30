import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, FileWarning, LockKeyhole, RefreshCw, Save, Send, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const defaultPolicies = {
  aiAnalysisEnabled: true,
  cheatDetection: {},
  invitationSecurity: { maxVerificationAttempts: 5, verificationLockoutMinutes: 15, applicantSessionMinutes: 240, reverificationCooldownMinutes: 0 },
};
const statusLabels = { ACTIVE: '활성', EXPIRED: '만료', REVOKED: '폐기', SUBMITTED: '제출 완료' };
const deliveryLabels = { SENT: '발송 완료', PREVIEW: '미리보기', PENDING: '처리 중', FAILED: '발송 실패' };
const progressLabels = { NOT_STARTED: '미응시', IN_PROGRESS: '응시 중', SUBMITTED: '제출 완료' };
const diagnosisLabels = { NOT_READY: '응시 전', NOT_REQUESTED: '진단 요청 전', PENDING: '진단 대기', PROCESSING: '진단 중', COMPLETED: '진단 완료', FAILED: '진단 실패' };
const formatDate = (value) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';

export default function InvitationSettingsTab() {
  const [policies, setPolicies] = useState(defaultPolicies);
  const [overview, setOverview] = useState({ metrics: {}, warnings: [], organizationStats: [], filterOptions: { organizations: [], exams: [] } });
  const [invitations, setInvitations] = useState([]);
  const [audits, setAudits] = useState([]);
  const [filters, setFilters] = useState({ status: '', query: '', organizationId: '', examId: '', sentFrom: '', sentTo: '', expiringSoon: false });
  const [message, setMessage] = useState('');
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

  const updateSecurity = (key, value) => setPolicies((current) => ({ ...current, invitationSecurity: { ...current.invitationSecurity, [key]: value } }));
  const metricCards = [[overview.metrics.active ?? 0, '활성 링크', ShieldCheck], [overview.metrics.sentToday ?? 0, '오늘 발송', Send], [overview.metrics.expiringSoon ?? 0, '24시간 내 만료', Clock3], [overview.metrics.deliveryFailures ?? 0, '발송 실패', FileWarning]];

  return <section className="workspace-shell">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">초대 운영 관리</span><h1>초대 링크 설정</h1><p>플랫폼 전역의 초대 정책, 보안 규칙, 발급 현황과 긴급 폐기를 관리합니다.</p></div><div className="workspace-role-mark admin"><ShieldCheck size={16} /> 관리자 전용 운영</div></div>
    {message && <div className="workspace-alert">{message}</div>}
    <div className="metric-grid">{metricCards.map(([value, label, Icon]) => <div className="metric-card" key={label}><Icon size={17} /><strong>{value}</strong><span>{label}</span></div>)}</div>

    <div className="data-panel form-panel invitation-security-panel"><div className="panel-heading"><div><h2>보안 정책</h2><p>링크 만료는 각 시험의 설정과 시험 종료 시각으로 결정합니다. 링크 원문과 토큰 해시는 어떤 사용자에게도 표시하지 않습니다.</p></div><LockKeyhole size={20} /></div>
      <div className="invitation-security-fixed"><strong>항상 적용되는 보호 규칙</strong><span>재발송 시 기존 미제출 링크는 자동 폐기되며, 제출 완료 링크는 즉시 차단됩니다.</span></div>
      <div className="security-setting-grid">
        <label><span><strong>응시번호 검증 실패 허용 횟수</strong><small>초과 시 링크별·IP별 접근을 잠급니다.</small></span><input type="number" min="1" max="10" value={policies.invitationSecurity.maxVerificationAttempts} onChange={(event) => updateSecurity('maxVerificationAttempts', Number(event.target.value))} /></label>
        <label><span><strong>잠금 시간</strong><small>검증 실패 제한을 초과한 뒤 재시도할 수 있는 시간입니다.</small></span><div className="security-number-input"><input type="number" min="1" max="1440" value={policies.invitationSecurity.verificationLockoutMinutes} onChange={(event) => updateSecurity('verificationLockoutMinutes', Number(event.target.value))} /><em>분</em></div></label>
        <label><span><strong>응시 세션 유효시간</strong><small>본인 확인 이후 시험 환경에 접근할 수 있는 최대 시간입니다.</small></span><div className="security-number-input"><input type="number" min="30" max="480" value={policies.invitationSecurity.applicantSessionMinutes} onChange={(event) => updateSecurity('applicantSessionMinutes', Number(event.target.value))} /><em>분</em></div></label>
        <label><span><strong>동일 링크 재인증 제한시간</strong><small>0분이면 제한하지 않으며, 설정 시 반복 인증 시도를 늦춥니다.</small></span><div className="security-number-input"><input type="number" min="0" max="1440" value={policies.invitationSecurity.reverificationCooldownMinutes} onChange={(event) => updateSecurity('reverificationCooldownMinutes', Number(event.target.value))} /><em>분</em></div></label>
      </div>
      <button className="primary-button" type="button" onClick={save} disabled={busy}><Save size={16} /> 보안 정책 저장</button>
    </div>

    {overview.warnings.length > 0 && <div className="workspace-alert error"><AlertTriangle size={16} /> <strong>운영 경고</strong>&nbsp; 발송 실패 또는 24시간 내 만료되는 링크가 {overview.warnings.length}건 있습니다.</div>}
    <div className="data-panel"><div className="panel-heading"><div><h2>전체 발급 현황</h2><p>발급 이력은 조회만 가능하며, 긴급 상황에서는 활성 링크만 폐기할 수 있습니다.</p></div><button className="secondary-button" type="button" onClick={() => load().catch(() => {})}><RefreshCw size={16} /> 새로고침</button></div>
      <div className="invitation-filter-bar"><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">전체 상태</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><label className="candidate-search-control"><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="조직, 시험, 응시자, 이메일 검색" /></label></div>
      <div className="invitation-filter-fields"><label>조직<select value={filters.organizationId} onChange={(event) => setFilters({ ...filters, organizationId: event.target.value, examId: '' })}><option value="">전체 조직</option>{overview.filterOptions.organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>시험<select value={filters.examId} onChange={(event) => setFilters({ ...filters, examId: event.target.value })}><option value="">전체 시험</option>{overview.filterOptions.exams.filter((item) => !filters.organizationId || item.organizationId === filters.organizationId).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>발송 시작일<input type="date" value={filters.sentFrom} onChange={(event) => setFilters({ ...filters, sentFrom: event.target.value })} /></label><label>발송 종료일<input type="date" value={filters.sentTo} onChange={(event) => setFilters({ ...filters, sentTo: event.target.value })} /></label></div>
      <label className="toggle-row invitation-expiring-toggle"><input type="checkbox" checked={filters.expiringSoon} onChange={(event) => setFilters({ ...filters, expiringSoon: event.target.checked })} /> 24시간 내 만료 링크만 보기</label>
      <div className="invitation-inventory-table"><table><thead><tr><th>조직 · 시험</th><th>응시자</th><th>발송/만료</th><th>링크 상태</th><th>응시 현황</th><th>결과 진단</th></tr></thead><tbody>{invitations.map((item) => <tr key={item.id}><td><strong>{item.organizationName}</strong><br /><span className="text-muted">{item.examTitle}</span></td><td>{item.candidateName}<br /><span className="text-muted">{item.candidateEmail}</span></td><td>{formatDate(item.sentAt)}<br /><span className={item.status === 'ACTIVE' && new Date(item.expiresAt).getTime() - Date.now() < 86400000 ? 'text-warning' : 'text-muted'}>{formatDate(item.expiresAt)}</span></td><td><span className={`status-badge ${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span><br /><small className="text-muted">{deliveryLabels[item.deliveryStatus] || item.deliveryStatus}</small></td><td><strong>{progressLabels[item.examProgress]}</strong><br /><small className="text-muted">{item.examineeStatusText}</small></td><td><strong>{diagnosisLabels[item.diagnosisStatus]}</strong><br /><small className="text-muted">{item.resultStatus === 'NOT_SUBMITTED' ? '결과 없음' : item.resultStatus}</small></td></tr>)}{!invitations.length && <tr><td colSpan="6" className="empty-state">조건에 맞는 초대 링크가 없습니다.</td></tr>}</tbody></table></div>
    </div>
    <div className="workspace-grid two-columns" style={{ marginTop: 20 }}><div className="data-panel"><div className="panel-heading"><div><h2>조직별 발송 품질</h2><p>미검증 링크가 많은 조직은 담당 관리자에게 재발송을 요청하세요.</p></div></div>{overview.organizationStats.map((item) => <div className="organization-row" key={item.organizationId}><div><strong>{item.organizationName}</strong><span>발급 {item.invitationCount} · 활성 {item.activeCount} · 검증 {item.verifiedCount}</span></div><span className="status-badge pending">미검증 {item.unverifiedCount}</span></div>)}</div><div className="data-panel"><div className="panel-heading"><div><h2>감사 로그</h2><p>정책 변경과 관리자 긴급 폐기 이력을 최근 100건까지 보관합니다.</p></div></div>{audits.slice(0, 8).map((item) => <div className="organization-row" key={item.id}><div><strong>{item.action === 'POLICY_UPDATED' ? '전역 정책 변경' : '초대 링크 긴급 폐기'}</strong><span>{item.actorName} · {formatDate(item.createdAt)}{item.reason ? ` · ${item.reason}` : ''}</span></div></div>)}{!audits.length && <p className="empty-state">기록된 초대 링크 감사 로그가 없습니다.</p>}</div></div>
  </section>;
}
