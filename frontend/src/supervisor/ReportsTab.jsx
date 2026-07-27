import React, { useEffect, useState } from 'react';
import { BarChart3, Building2, FileText } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function ReportsTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [results, setResults] = useState([]);
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
      .catch((reason) => setError(apiErrorMessage(reason, '결과를 조회할 조직 목록을 불러오지 못했습니다.')));
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setExams([]);
      setSelectedExamId('');
      return;
    }
    api.get('/supervisor/exams?organizationId=' + encodeURIComponent(organizationId), { headers: authHeaders() })
      .then(({ data }) => {
        setExams(data);
        setSelectedExamId(data[0]?.id || '');
      })
      .catch((reason) => setError(apiErrorMessage(reason, '조직의 시험 목록을 불러오지 못했습니다.')));
  }, [organizationId]);

  useEffect(() => {
    if (!selectedExamId || !organizationId) {
      setResults([]);
      return;
    }
    api.get(`/manager/results?organizationId=${encodeURIComponent(organizationId)}&examId=${encodeURIComponent(selectedExamId)}`, { headers: authHeaders() })
      .then(({ data }) => setResults(data))
      .catch((reason) => setError(apiErrorMessage(reason, '결과를 불러오지 못했습니다.')));
  }, [organizationId, selectedExamId]);

  const changeOrganization = (nextOrganizationId) => {
    setError('');
    setExams([]);
    setSelectedExamId('');
    setResults([]);
    setOrganizationId(nextOrganizationId);
  };

  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">RESULT REPORTS</span>
          <h1>응시자 결과 관리</h1>
          <p>현재 작업 조직의 시험 결과만 조회합니다.</p>
        </div>
        <div className="workspace-role-mark manager"><BarChart3 size={20} /> 조직별 결과</div>
      </div>
      {error && <div className="workspace-alert error">{error}</div>}
      <div className="data-panel organization-switcher">
        <label><span>결과 조직</span>
          <select value={organizationId} onChange={(event) => changeOrganization(event.target.value)}>
            <option value="">결과를 조회할 조직을 선택하세요</option>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>
        <span className="organization-scope-note"><Building2 size={15} /> {selectedOrganization ? selectedOrganization.name + ' 소속 시험만 표시' : '배정된 승인 조직만 표시됩니다.'}</span>
      </div>
      <div className="data-panel organization-switcher">
        <label><span>조회 시험</span>
          <select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)} disabled={!organizationId}>
            <option value="">시험을 선택하세요</option>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
          </select>
        </label>
        <span>{selectedExamId ? `${results.length}명 결과` : '조직과 시험을 선택하세요.'}</span>
      </div>
      <div className="data-panel" style={{ overflowX: 'auto' }}>
        <div className="panel-heading">
          <div><h2>결과 목록</h2><p>선택한 조직과 시험에 속한 배정 결과만 표시됩니다.</p></div>
          <FileText size={20} />
        </div>
        <table className="status-table"><thead><tr><th>응시자</th><th>이메일</th><th>배정 상태</th><th>점수</th><th>제출 시간</th></tr></thead><tbody>
          {results.map((result) => <tr key={result.id}><td>{result.candidateName}</td><td>{result.candidateEmail}</td><td>{result.status}</td><td>{result.score ?? '-'}</td><td>{result.submittedAt ? new Date(result.submittedAt).toLocaleString('ko-KR') : '-'}</td></tr>)}
        </tbody></table>
        {!organizationId && <p className="empty-state">결과를 조회할 조직을 선택해주세요.</p>}
        {organizationId && !selectedExamId && <p className="empty-state">결과를 조회할 시험을 선택해주세요.</p>}
        {selectedExamId && !results.length && <p className="empty-state">선택한 시험의 결과가 없습니다.</p>}
      </div>
    </section>
  );
}
