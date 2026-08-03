import React, { useEffect, useMemo, useState } from 'react';
import { Save, ShieldAlert } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const defaultPolicies = { aiAnalysisEnabled: true, cheatDetection: { gazeWarningEnabled: true, audioDetectionEnabled: true, tabSwitchSubmitEnabled: true } };

export default function ExamPolicyTab() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [policies, setPolicies] = useState(defaultPolicies);
  const [message, setMessage] = useState('');
  const selectedExam = useMemo(() => exams.find((exam) => exam.id === examId), [exams, examId]);

  useEffect(() => {
    api.get('/supervisor/exams', { headers: authHeaders() }).then(({ data }) => {
      setExams(data);
      setExamId(data[0]?.id || '');
    }).catch((error) => setMessage(apiErrorMessage(error, '시험 목록을 불러오지 못했습니다.')));
  }, []);

  useEffect(() => {
    if (!examId) return;
    api.get(`/supervisor/exams/${examId}/policies`, { headers: authHeaders() })
      .then(({ data }) => setPolicies(data))
      .catch((error) => setMessage(apiErrorMessage(error, '시험 금지사항을 불러오지 못했습니다.')));
  }, [examId]);

  const updateDetection = (key, value) => setPolicies((current) => ({
    ...current,
    cheatDetection: { ...current.cheatDetection, [key]: value },
  }));

  const save = async () => {
    try {
      const { data } = await api.patch(`/supervisor/exams/${examId}/policies`, policies, { headers: authHeaders() });
      setPolicies(data);
      setMessage('시험 금지사항을 저장했습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, '시험 금지사항 저장에 실패했습니다.'));
    }
  };

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">시험 운영 규칙</span><h1>시험 금지사항 관리</h1><p>배정된 조직의 시험별 부정행위 감지와 대응 규칙을 관리합니다.</p></div>
        <div className="workspace-role-mark exam-policy-prohibition"><ShieldAlert size={16} /> 매니저 운영 정책</div>
      </div>
      {message && <div className="workspace-alert">{message}</div>}
      <div className="data-panel form-panel exam-policy-panel">
        <label>대상 시험
          <select value={examId} onChange={(event) => setExamId(event.target.value)}>
            <option value="">시험을 선택하세요</option>
            {exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title} ({exam.date})</option>)}
          </select>
        </label>
        {selectedExam && <p className="form-hint">{selectedExam.organizationName || '담당 조직'} · {selectedExam.title}</p>}
        <label className="toggle-row"><input type="checkbox" checked={policies.cheatDetection.gazeWarningEnabled} onChange={(event) => updateDetection('gazeWarningEnabled', event.target.checked)} /> 시선 이탈 감지 시 자동 경고 발송</label>
        <label className="toggle-row"><input type="checkbox" checked={policies.cheatDetection.audioDetectionEnabled} onChange={(event) => updateDetection('audioDetectionEnabled', event.target.checked)} /> 음성·이어폰 감지 시 부정행위 로그 기록</label>
        <label className="toggle-row"><input type="checkbox" checked={policies.cheatDetection.tabSwitchSubmitEnabled} onChange={(event) => updateDetection('tabSwitchSubmitEnabled', event.target.checked)} /> 전체 화면 이탈 시 시험 강제 제출</label>
        <button className="primary-button" type="button" disabled={!examId} onClick={save}><Save size={16} /> 금지사항 저장</button>
      </div>
    </section>
  );
}
