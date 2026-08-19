import React, { useEffect, useState } from 'react';
import { Building2, Check, Pencil, Plus, Save, Search, Trash2, Users, UserPlus, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function ManagerWorkspaceTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationForm, setOrganizationForm] = useState({ name: '' });
  const [joinCode, setJoinCode] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [candidateOrganizationId, setCandidateOrganizationId] = useState('');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidateForm, setCandidateForm] = useState({ name: '', email: '', birthDate: '' });
  const [editingCandidateId, setEditingCandidateId] = useState('');
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('apply');

  const load = async () => {
    const headers = { headers: authHeaders() };
    const [orgs, requests, candidateResponse] = await Promise.all([
      api.get('/manager/organizations', headers),
      api.get('/manager/organization-join-requests', headers),
      api.get('/manager/candidates?scope=ORGANIZATION', headers),
    ]);
    setOrganizations(orgs.data);
    setJoinRequests(requests.data);
    setCandidates(candidateResponse.data);
    const manageable = orgs.data.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
    setCandidateOrganizationId((current) => manageable.some((organization) => organization.id === current) ? current : (manageable[0]?.id || ''));
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

  const resetCandidateForm = () => {
    setCandidateForm({ name: '', email: '', birthDate: '' });
    setEditingCandidateId('');
  };

  const saveCandidate = async (event) => {
    event.preventDefault();
    if (!candidateOrganizationId) return;
    setSavingCandidate(true);
    try {
      if (editingCandidateId) await api.patch(`/manager/candidates/${editingCandidateId}`, candidateForm, { headers: authHeaders() });
      else await api.post('/manager/candidates', { ...candidateForm, organizationId: candidateOrganizationId, scope: 'ORGANIZATION' }, { headers: authHeaders() });
      setMessage(editingCandidateId ? '조직 응시자 정보를 수정했습니다.' : '조직 응시자를 추가했습니다.');
      resetCandidateForm();
      await load();
    } catch (error) {
      setMessage(apiErrorMessage(error, editingCandidateId ? '조직 응시자 정보를 수정하지 못했습니다.' : '조직 응시자를 추가하지 못했습니다.'));
    } finally {
      setSavingCandidate(false);
    }
  };

  const editCandidate = (candidate) => {
    setCandidateOrganizationId(candidate.organizationId);
    setCandidateForm({ name: candidate.name || '', email: candidate.email || '', birthDate: candidate.birthDate || '' });
    setEditingCandidateId(candidate.id);
  };

  const removeCandidate = async (candidate) => {
    if (!window.confirm(`${candidate.name} 응시자를 조직에서 제거할까요? 시험 배정 정보도 함께 제거됩니다.`)) return;
    try {
      await api.delete(`/manager/candidates/${candidate.id}`, { headers: authHeaders() });
      if (editingCandidateId === candidate.id) resetCandidateForm();
      setMessage('조직 응시자를 제거했습니다.');
      await load();
    } catch (error) {
      setMessage(apiErrorMessage(error, '조직 응시자를 제거하지 못했습니다.'));
    }
  };

  const approvedOrganizations = organizations.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
  const pendingOrganizations = organizations.filter((organization) => organization.status === 'PENDING');
  const inactiveOrganizations = organizations.filter((organization) => ['REJECTED', 'SUSPENDED'].includes(organization.status));
  const pendingActionableRequests = joinRequests.filter((request) => request.status === 'PENDING' && request.canApprove).length;
  const visibleCandidates = candidates.filter((candidate) => candidate.organizationId === candidateOrganizationId)
    .filter((candidate) => `${candidate.name} ${candidate.email} ${candidate.candidateNumber || ''}`.toLowerCase().includes(candidateQuery.trim().toLowerCase()));

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">ORGANIZATION MANAGEMENT</span>
          <h1>조직 관리</h1>
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

      <section className="data-panel organization-candidate-panel">
        <div className="panel-heading organization-candidate-heading">
          <div><h2>조직 응시자 관리</h2><p>자동 시험 운영에서 사용할 조직 공용 응시자 명단을 추가·수정·제거합니다.</p></div>
          <div className="organization-candidate-tools"><select aria-label="응시자 관리 조직" value={candidateOrganizationId} onChange={(event) => { setCandidateOrganizationId(event.target.value); resetCandidateForm(); }}>{approvedOrganizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select><label><Search size={15} /><input aria-label="조직 응시자 검색" value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="이름·이메일·응시번호 검색" /></label></div>
        </div>
        {!approvedOrganizations.length ? <p className="empty-state">관리할 수 있는 승인 조직이 없습니다.</p> : <div className="organization-candidate-layout">
          <form className="organization-candidate-form" onSubmit={saveCandidate}>
            <div><strong>{editingCandidateId ? '응시자 정보 수정' : '새 응시자 추가'}</strong>{editingCandidateId && <button className="text-button" type="button" onClick={resetCandidateForm}>수정 취소</button>}</div>
            <label>이름<input value={candidateForm.name} onChange={(event) => setCandidateForm({ ...candidateForm, name: event.target.value })} required /></label>
            <label>이메일<input type="email" value={candidateForm.email} onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })} required /></label>
            <label>생년월일<input type="date" value={candidateForm.birthDate} onChange={(event) => setCandidateForm({ ...candidateForm, birthDate: event.target.value })} required /></label>
            <button className="primary-button" type="submit" disabled={savingCandidate}>{editingCandidateId ? <Save size={16} /> : <UserPlus size={16} />} {savingCandidate ? '저장 중...' : editingCandidateId ? '수정 사항 저장' : '응시자 추가'}</button>
          </form>
          <div className="organization-candidate-list"><div className="organization-candidate-list-heading"><strong>등록된 응시자</strong><span>{visibleCandidates.length}명</span></div>{visibleCandidates.map((candidate) => <article className="organization-candidate-row" key={candidate.id}><div><strong>{candidate.name}</strong><span>{candidate.email}</span><small>{candidate.candidateNumber || '응시번호 미발급'} · {candidate.birthDate}</small></div><div><button className="secondary-button compact-button" type="button" onClick={() => editCandidate(candidate)}><Pencil size={14} /> 수정</button><button className="danger-button compact-button" type="button" onClick={() => removeCandidate(candidate)}><Trash2 size={14} /> 제거</button></div></article>)}{!visibleCandidates.length && <p className="empty-state">조건에 맞는 조직 응시자가 없습니다.</p>}</div>
        </div>}
      </section>

      <div className="data-panel workspace-next-step">
        <strong>시험 운영이 필요하신가요?</strong>
        <span>시험 관리 메뉴에서 조직별 운영 대상을 선택할 수 있습니다.</span>
      </div>
    </section>
  );
}
