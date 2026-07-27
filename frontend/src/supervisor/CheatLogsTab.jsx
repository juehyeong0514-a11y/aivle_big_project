import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, ShieldAlert } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function CheatLogsTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/manager/organizations', { headers: authHeaders() })
      .then(({ data }) => {
        const managedOrganizations = data.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
        setOrganizations(managedOrganizations);
        setOrganizationId((current) => managedOrganizations.some((organization) => organization.id === current)
          ? current
          : managedOrganizations[0]?.id || '');
      })
      .catch((reason) => setError(apiErrorMessage(reason, '조회할 조직 목록을 불러오지 못했습니다.')));
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setExams([]);
      setSelectedExamId('');
      return;
    }
    api.get(`/supervisor/exams?organizationId=${encodeURIComponent(organizationId)}`, { headers: authHeaders() })
      .then(({ data }) => {
        setExams(data);
        setSelectedExamId(data[0]?.id || '');
      })
      .catch((reason) => setError(apiErrorMessage(reason, '조직 시험 목록을 불러오지 못했습니다.')));
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !selectedExamId) {
      setWarnings([]);
      return;
    }
    api.get(`/supervisor/warnings?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() })
      .then(({ data }) => setWarnings(data))
      .catch((reason) => setError(apiErrorMessage(reason, '부정행위 로그를 불러오지 못했습니다.')));
  }, [organizationId, selectedExamId]);

  const changeOrganization = (nextOrganizationId) => {
    setError('');
    setExams([]);
    setSelectedExamId('');
    setWarnings([]);
    setOrganizationId(nextOrganizationId);
  };

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);

  return <section className="workspace-shell"><div className="workspace-heading"><div><span className="workspace-eyebrow">CHEAT LOGS</span><h1>부정행위 감지 로그</h1><p>현재 작업 조직의 선택한 시험에서 전송한 응시자 경고 기록입니다.</p></div><ShieldAlert size={22} color="#ef4444" /></div>{error && <div className="workspace-alert error">{error}</div>}<div className="data-panel organization-switcher"><label><span>조회 조직</span><select value={organizationId} onChange={(event) => changeOrganization(event.target.value)}><option value="">조회할 조직을 선택하세요</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><span className="organization-scope-note"><Building2 size={15} /> {selectedOrganization ? `${selectedOrganization.name} 소속 시험만 표시` : '배정된 승인 조직만 표시합니다.'}</span></div><div className="data-panel organization-switcher"><label><span>조회 시험</span><select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)} disabled={!organizationId}><option value="">시험을 선택하세요</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label></div><div className="data-panel"><div className="organization-list">{!organizationId && <p className="empty-state">조회할 조직을 선택해주세요.</p>}{organizationId && !exams.length && <p className="empty-state">선택한 조직에 등록된 시험이 없습니다.</p>}{warnings.map((warning) => <article className="organization-row" key={warning.id}><div><strong><AlertTriangle size={16} /> {warning.examineeName}</strong><span>{warning.message}</span><small>{new Date(warning.createdAt).toLocaleString('ko-KR')}</small></div><span className="status-badge warning">경고 발송</span></article>)}{selectedExamId && !warnings.length && <p className="empty-state">선택한 시험의 경고 로그가 없습니다.</p>}</div></div></section>;
}
