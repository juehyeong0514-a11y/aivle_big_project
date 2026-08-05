import React, { useEffect, useState } from 'react';
import { Building2, Check, Plus, Users, UserPlus, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function ManagerWorkspaceTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationForm, setOrganizationForm] = useState({ name: '' });
  const [joinCode, setJoinCode] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('apply');

  const load = async () => {
    const headers = { headers: authHeaders() };
    const [orgs, requests] = await Promise.all([
      api.get('/manager/organizations', headers),
      api.get('/manager/organization-join-requests', headers),
    ]);
    setOrganizations(orgs.data);
    setJoinRequests(requests.data);
  };

  const joinOrganization = async (event) => {
    event.preventDefault();
    try {
      await api.post('/manager/organizations/join', { code: joinCode }, { headers: authHeaders() });
      setJoinCode('');
      setMessage('조직 참여 신청을 보냈습니다. 해당 조직 관리자 승인 후 조직이 표시됩니다.');
      await load();
    } catch (error) {
      setMessage(apiErrorMessage(error, '조직코드 참여 신청에 실패했습니다.'));
    }
  };

  const reviewJoinRequest = async (id, action) => {
    try {
      await api.post(`/manager/organization-join-requests/${id}/${action}`, null, { headers: authHeaders() });
      setMessage(action === 'approve' ? '조직 참여 신청을 승인했습니다.' : '조직 참여 신청을 거절했습니다.');
      await load();
    } catch (error) {
      setMessage(apiErrorMessage(error, '조직 참여 신청 처리에 실패했습니다.'));
    }
  };

  useEffect(() => {
    load().catch((error) => setMessage(apiErrorMessage(error, '조직 운영 정보를 불러오지 못했습니다.')));
  }, []);

  const createOrganization = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post('/manager/organizations', organizationForm, { headers: authHeaders() });
      setOrganizationForm({ name: '' });
      setMessage(`조직 생성 요청을 제출했습니다. 발급된 조직 코드 ${data.code}를 구성원에게 안내할 수 있습니다.`);
      await load();
    } catch (error) {
      setMessage(apiErrorMessage(error, '조직 생성 요청에 실패했습니다.'));
    }
  };

  const approvedOrganizations = organizations.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
  const pendingOrganizations = organizations.filter((organization) => organization.status === 'PENDING');
  const inactiveOrganizations = organizations.filter((organization) => ['REJECTED', 'SUSPENDED'].includes(organization.status));
  const pendingActionableRequests = joinRequests.filter((request) => request.status === 'PENDING' && request.canApprove).length;

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">MANAGER WORKSPACE</span>
          <h1>조직 운영</h1>
          <p>조직 신청과 관리자 승인 상태, 배정된 조직 정보를 확인합니다.</p>
        </div>
        <div className="workspace-role-mark manager"><Users size={20} /> 조직 관리자</div>
      </div>
      {message && <div className="workspace-alert">{message}</div>}

      <div className="workspace-grid two-columns">
        <div className="data-panel">
          <div className="panel-heading">
            <div><h2>내 조직</h2><p>승인된 조직만 시험 관리와 응시자 업무에 사용할 수 있습니다.</p></div>
            <Building2 size={20} />
          </div>
          <div className="organization-list">
            {approvedOrganizations.map((organization) => <article className="organization-row" key={organization.id}>
              <div><strong>{organization.name}</strong><span>{organization.code}</span></div>
              <span className="status-badge approved">승인 완료</span>
            </article>)}
            {!approvedOrganizations.length && <p className="empty-state">참여 중인 승인 조직이 없습니다.</p>}
            {pendingOrganizations.length > 0 && <div className="workspace-subsection"><strong>승인 대기</strong>{pendingOrganizations.map((organization) => <article className="organization-row" key={organization.id}><div><strong>{organization.name}</strong><span>{organization.code}</span></div><span className="status-badge pending">승인 대기</span></article>)}</div>}
            {inactiveOrganizations.length > 0 && <div className="workspace-subsection"><strong>운영 중지 또는 거절 조직</strong>{inactiveOrganizations.map((organization) => <article className="organization-row" key={organization.id}><div><strong>{organization.name}</strong><span>{organization.code}</span></div><span className={'status-badge ' + organization.status.toLowerCase()}>{organization.status}</span></article>)}</div>}
          </div>
        </div>

        <div className="data-panel workspace-tab-panel">
          <div className="workspace-tabs" role="tablist" aria-label="조직 신청 및 참여">
            <button type="button" role="tab" aria-selected={activeTab === 'apply'} className="workspace-tab-btn" onClick={() => setActiveTab('apply')}><Plus size={14} /> 조직 신청</button>
            <button type="button" role="tab" aria-selected={activeTab === 'join'} className="workspace-tab-btn" onClick={() => setActiveTab('join')}><UserPlus size={14} /> 조직코드로 참여</button>
            <button type="button" role="tab" aria-selected={activeTab === 'requests'} className="workspace-tab-btn" onClick={() => setActiveTab('requests')}><Users size={14} /> 가입요청{pendingActionableRequests > 0 && <span className="workspace-tab-dot">{pendingActionableRequests}</span>}</button>
          </div>

          {activeTab === 'apply' && <form className="form-panel" role="tabpanel" onSubmit={createOrganization}>
            <p className="form-hint">새 조직은 관리자 승인 대기 상태로 생성됩니다.</p>
            <label>조직명<input value={organizationForm.name} onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })} placeholder="A대학교 컴퓨터공학과" required /></label>
            <p className="form-hint">조직 코드는 중복되지 않는 번호로 자동 발급됩니다.</p>
            <button className="secondary-button" type="submit"><Plus size={16} /> 조직 생성 요청</button>
          </form>}

          {activeTab === 'join' && <form className="form-panel" role="tabpanel" onSubmit={joinOrganization}>
            <p className="form-hint">조직에서 안내받은 코드를 입력하면 해당 조직 관리자에게 승인 요청이 전달됩니다.</p>
            <label>조직 코드<input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="예: AIVLE-CS" required /></label>
            <button className="primary-button" type="submit"><UserPlus size={16} /> 조직 참여 신청</button>
          </form>}

          {activeTab === 'requests' && <div role="tabpanel">
            <p className="form-hint">내 신청과 내가 관리하는 조직의 신청을 확인합니다.</p>
            <div className="organization-list">
              {joinRequests.map((request) => <article className="organization-row" key={request.id}>
                <div><strong>{request.organizationName}</strong><span>{request.organizationCode} · {request.requesterName}</span></div>
                <div className="organization-row-actions">
                  <span className={'status-badge ' + request.status.toLowerCase()}>{request.status === 'PENDING' ? '승인 대기' : request.status === 'APPROVED' ? '승인 완료' : '거절됨'}</span>
                  {request.status === 'PENDING' && request.canApprove && <><button className="icon-button" type="button" aria-label="조직 참여 승인" onClick={() => reviewJoinRequest(request.id, 'approve')}><Check size={16} /></button><button className="icon-button danger" type="button" aria-label="조직 참여 거절" onClick={() => reviewJoinRequest(request.id, 'reject')}><X size={16} /></button></>}
                </div>
              </article>)}
              {!joinRequests.length && <p className="empty-state">조직 참여 신청이 없습니다.</p>}
            </div>
          </div>}
        </div>
      </div>

      <div className="data-panel workspace-next-step">
        <strong>시험 운영이 필요하신가요?</strong>
        <span>시험 관리 메뉴에서 조직별 운영 대상을 선택할 수 있습니다.</span>
      </div>
    </section>
  );
}
