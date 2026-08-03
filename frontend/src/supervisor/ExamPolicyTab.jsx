import React, { useEffect, useMemo, useState } from 'react';
import { Save, ShieldAlert } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

const defaultPolicies = {
  aiAnalysisEnabled: true,
  cheatDetection: {
    noPersonWarningEnabled: true,
    multiplePeopleWarningEnabled: true,
    cellPhoneWarningEnabled: true,
    bookWarningEnabled: false,
  },
};

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
      .catch((error) => setMessage(apiErrorMessage(error, 'AI 감지 설정을 불러오지 못했습니다.')));
  }, [examId]);

  const updateDetection = (key, value) => setPolicies((current) => ({
    ...current,
    cheatDetection: { ...current.cheatDetection, [key]: value },
  }));

  const save = async () => {
    try {
      const { data } = await api.patch(`/supervisor/exams/${examId}/policies`, policies, { headers: authHeaders() });
      setPolicies(data);
      setMessage('시험 AI 감지 설정을 저장했습니다.');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'AI 감지 설정 저장에 실패했습니다.'));
    }
  };

  const detectionDisabled = !policies.aiAnalysisEnabled;

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">AI PROCTORING</span><h1>시험 AI 감지 설정</h1><p>YOLO가 실제로 탐지하는 항목과 자동 경고 기록 여부를 시험별로 설정합니다.</p></div>
        <div className="workspace-role-mark exam-policy-prohibition"><ShieldAlert size={16} /> 매니저 운영 설정</div>
      </div>
      {message && <div className="workspace-alert">{message}</div>}
      <div className="data-panel form-panel exam-policy-panel">
        <label>대상 시험
          <select value={examId} onChange={(event) => setExamId(event.target.value)}>
            <option value="">시험을 선택하세요</option>
            {exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title} ({exam.date})</option>)}
          </select>
        </label>
        {selectedExam && <p className="form-hint">{selectedExam.organizationName || '해당 조직'} · {selectedExam.title}</p>}
        <label className="toggle-row"><input type="checkbox" checked={policies.aiAnalysisEnabled} onChange={(event) => setPolicies((current) => ({ ...current, aiAnalysisEnabled: event.target.checked }))} /> 웹캠 YOLO 객체 감지 활성화</label>
        <p className="form-hint">활성화하면 웹캠 정지 화면을 주기적으로 분석합니다. 비활성화하면 AI 분석 요청과 자동 경고 기록이 중단됩니다.</p>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.noPersonWarningEnabled} onChange={(event) => updateDetection('noPersonWarningEnabled', event.target.checked)} /> 응시자 미감지 반복 시 자동 경고 기록</label>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.multiplePeopleWarningEnabled} onChange={(event) => updateDetection('multiplePeopleWarningEnabled', event.target.checked)} /> 여러 사람 반복 감지 시 자동 경고 기록</label>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.cellPhoneWarningEnabled} onChange={(event) => updateDetection('cellPhoneWarningEnabled', event.target.checked)} /> 휴대전화 반복 감지 시 자동 경고 기록</label>
        <label className="toggle-row"><input type="checkbox" disabled={detectionDisabled} checked={policies.cheatDetection.bookWarningEnabled} onChange={(event) => updateDetection('bookWarningEnabled', event.target.checked)} /> 책 반복 감지 시 자동 경고 기록</label>
        <p className="form-hint">책 감지는 AI 감독 서비스의 책 탐지 기능이 활성화된 환경에서 동작합니다.</p>
        <p className="form-hint">경고는 연속 감지 기준과 재알림 대기시간을 충족하면 매니저 감시 로그와 응시자 경고창에 표시됩니다.</p>
        <button className="primary-button" type="button" disabled={!examId} onClick={save}><Save size={16} /> 설정 저장</button>
      </div>
    </section>
  );
}
