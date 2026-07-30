import React, { useEffect, useState } from 'react';
import { Check, ShieldCheck, UserCheck, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const statusLabels = { PENDING: '승인 대기', APPROVED: '승인 완료', REJECTED: '승인 거절', SUSPENDED: '운영 중지' };

export default function AdminGovernanceTab() {
  const [overview, setOverview] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const headers = { headers: authHeaders() };
    const [overviewResponse, organizationsResponse, managersResponse] = await Promise.all([
      api.get('/admin/overview', headers),
      api.get('/admin/organizations', headers),
      api.get('/admin/users', headers),
    ]);
    setOverview(overviewResponse.data);
    setOrganizations(organizationsResponse.data);
    setManagers(managersResponse.data);
  };

  useEffect(() => { load().catch((error) => setMessage(apiErrorMessage(error, '관리 현황을 불러오지 못했습니다.'))); }, []);

  const updateOrganization = async (id, status) => {
    try {
      await api.patch(`/admin/organizations/${id}`, { status }, { headers: authHeaders() });
      setMessage(`조직 상태를 ${statusLabels[status]}로 변경했습니다.`);
      await load();
    } catch (error) { setMessage(apiErrorMessage(error, '조직 상태를 변경하지 못했습니다.')); }
  };

  const updateManagerStatus = async (id, status) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status }, { headers: authHeaders() });
      setMessage(`관리자 계정을 ${statusLabels[status]} 처리했습니다.`);
      await load();
    } catch (error) { setMessage(apiErrorMessage(error, '관리자 계정 상태를 변경하지 못했습니다.')); }
  };

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">관리자 운영 센터</span><h1>조직 승인 및 관리자 관리</h1><p>플랫폼 전체 조직, 구성원, 관리자 가입 상태를 검토합니다.</p></div>
        <div className="workspace-role-mark admin"><ShieldCheck size={20} /> 전체 운영자</div>
      </div>
      {message && <div className="workspace-alert">{message}</div>}
      <div className="metric-grid">
        {[[overview?.organizations ?? '-', '전체 조직'], [overview?.pendingOrganizations ?? '-', '승인 대기'], [overview?.managers ?? '-', '관리자 계정'], [overview?.candidates ?? '-', '전체 응시자']].map(([value, label]) => <div className="metric-card" key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <div className="workspace-grid two-columns">
        <div className="data-panel">
          <div className="panel-heading"><div><h2>조직 승인 큐</h2><p>조직 신청자가 승인되면 해당 조직의 첫 관리자로 자동 등록됩니다.</p></div></div>
          <div className="organization-list">
            {organizations.map((organization) => <article className="organization-row" key={organization.id}>
              <div><strong>{organization.name}</strong><span>{organization.code} · 조직 구성원 {organization.managers?.length ?? 0}명</span>{organization.managers?.length > 0 && <div className="organization-managers">{organization.managers.map((manager) => <small key={manager.id}>{manager.name} · {manager.email}</small>)}</div>}{organization.status === 'APPROVED' && !organization.managers?.length && <small className="text-warning">조직 구성원이 없습니다.</small>}</div>
              <div className="organization-actions"><span className={`status-badge ${organization.status.toLowerCase()}`}>{statusLabels[organization.status]}</span>{organization.status === 'PENDING' && <><button className="icon-action approve" onClick={() => updateOrganization(organization.id, 'APPROVED')} title="조직 승인"><Check size={16} /></button><button className="icon-action reject" onClick={() => updateOrganization(organization.id, 'REJECTED')} title="조직 거절"><X size={16} /></button></>}</div>
            </article>)}
            {organizations.length === 0 && <p className="empty-state">등록된 조직이 없습니다.</p>}
          </div>
        </div>
        <div className="data-panel"><div className="panel-heading"><div><h2>관리자 가입 승인</h2><p>관리자가 회원가입하면 관리자 승인 후 로그인할 수 있습니다.</p></div><UserCheck size={20} /></div><div className="organization-list">{managers.map((manager) => <article className="organization-row" key={manager.id}><div><strong>{manager.name}</strong><span>{manager.email}</span></div><div className="organization-actions"><span className={`status-badge ${(manager.approvalStatus || 'PENDING').toLowerCase()}`}>{statusLabels[manager.approvalStatus] || '승인 대기'}</span>{manager.approvalStatus === 'PENDING' && <><button className="icon-action approve" onClick={() => updateManagerStatus(manager.id, 'APPROVED')} title="관리자 승인"><Check size={16} /></button><button className="icon-action reject" onClick={() => updateManagerStatus(manager.id, 'REJECTED')} title="관리자 거절"><X size={16} /></button></>}</div></article>)}{!managers.length && <p className="empty-state">가입한 관리자가 없습니다.</p>}</div></div>
      </div>
    </section>
  );
}
