import React, { useEffect, useState } from 'react';
import { Building2, Monitor, Video } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function LiveMonitoringTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examinees, setExaminees] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.get('/manager/organizations', { headers: authHeaders() })
      .then(({ data }) => {
        const managedOrganizations = data.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
        setOrganizations(managedOrganizations);
        setOrganizationId((current) => managedOrganizations.some((organization) => organization.id === current)
          ? current
          : managedOrganizations[0]?.id || '');
      })
      .catch((error) => setLoadError(apiErrorMessage(error, '관제할 조직 목록을 불러오지 못했습니다.')));
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
      .catch((error) => setLoadError(apiErrorMessage(error, '조직의 시험 목록을 불러오지 못했습니다.')));
  }, [organizationId]);

  useEffect(() => {
    if (!selectedExamId) {
      setExaminees([]);
      return undefined;
    }
    const loadExaminees = () => api.get('/supervisor/examinees?examId=' + encodeURIComponent(selectedExamId), { headers: authHeaders() })
      .then(({ data }) => setExaminees(data))
      .catch((error) => setLoadError(apiErrorMessage(error, '선택한 시험의 응시자 데이터를 불러오지 못했습니다.')));
    loadExaminees();
    const timer = window.setInterval(loadExaminees, 5000);
    return () => window.clearInterval(timer);
  }, [selectedExamId]);

  const sendWarning = async (examinee) => {
    const message = window.prompt('[' + examinee.name + '] 응시자에게 보낼 경고 메시지를 입력하세요.');
    if (!message) return;
    try {
      const { data } = await api.post('/supervisor/examinees/' + examinee.id + '/warnings', { examId: selectedExamId, message }, { headers: authHeaders() });
      window.alert('[전송 완료] ' + examinee.name + '님에게 ' + data.message);
    } catch (error) {
      window.alert(apiErrorMessage(error, '경고를 전송하지 못했습니다.'));
    }
  };

  const selectedExam = exams.find((exam) => exam.id === selectedExamId);
  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">LIVE MONITORING</span>
          <h1>실시간 화상 관제실</h1>
          <p>현재 작업 조직의 시험만 조회하고 응시자 상태를 실시간으로 확인합니다.</p>
        </div>
        <div className="workspace-role-mark manager"><Monitor size={20} /> 시험 감독 관리자</div>
      </div>

      {loadError && <div className="workspace-alert error">{loadError}</div>}
      <div className="data-panel organization-switcher">
        <label><span>관제 조직</span>
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            <option value="">관제할 조직을 선택하세요</option>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>
        <span className="organization-scope-note"><Building2 size={15} /> {selectedOrganization ? selectedOrganization.name + ' 소속 시험만 표시' : '배정된 승인 조직만 표시됩니다.'}</span>
      </div>

      <div className="data-panel organization-switcher">
        <label><span>관제할 시험</span>
          <select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)} disabled={!organizationId}>
            <option value="">시험을 선택하세요</option>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
          </select>
        </label>
        <span>{selectedExam ? `${selectedExam.examineeCount}명 관제 중` : '선택한 조직의 시험을 선택하세요.'}</span>
      </div>

      {!organizationId && <div className="data-panel empty-state">관제할 조직을 선택해주세요.</div>}
      {organizationId && !exams.length && <div className="data-panel empty-state">선택한 조직에 등록된 시험이 없습니다.</div>}
      {selectedExamId && !examinees.length && <div className="data-panel empty-state">현재 선택한 시험에서 관제 중인 응시자가 없습니다.</div>}
      <div className="monitoring-grid">
        {examinees.map((examinee) => (
          <article key={examinee.id} className={'monitoring-card ' + examinee.status.toLowerCase()}>
            <div className="monitoring-card-heading">
              <strong>{examinee.name} 응시자</strong>
              <span className={'status-badge ' + (examinee.status === 'NORMAL' ? 'approved' : examinee.status.toLowerCase())}>{examinee.statusText}</span>
            </div>
            <div className="monitoring-video-grid">
              <div><span>정면 화면</span><Video size={24} /></div>
              <div><span>보조 모니터링</span><Monitor size={24} /></div>
            </div>
            <p>진행 현황: <strong>{examinee.currentProb}</strong></p>
            <button className="btn-secondary warning-action" type="button" onClick={() => sendWarning(examinee)}>경고 메시지 발송</button>
          </article>
        ))}
      </div>
    </section>
  );
}
