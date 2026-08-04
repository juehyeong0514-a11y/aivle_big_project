import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Save,
  ShieldCheck,
  Smartphone,
  UserRoundX,
  UsersRound,
} from 'lucide-react';
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

const detectionItems = [
  {
    key: 'noPersonWarningEnabled',
    label: '응시자 이탈',
    description: '화면에서 응시자가 사라진 상황을 기록합니다.',
    icon: UserRoundX,
  },
  {
    key: 'multiplePeopleWarningEnabled',
    label: '여러 사람 감지',
    description: '화면에 2명 이상의 사람이 나타난 상황을 기록합니다.',
    icon: UsersRound,
  },
  {
    key: 'cellPhoneWarningEnabled',
    label: '휴대전화 감지',
    description: '휴대전화가 노출되거나 사용된 상황을 기록합니다.',
    icon: Smartphone,
  },
  {
    key: 'bookWarningEnabled',
    label: '책·자료 감지',
    description: '책 또는 인쇄물이 노출된 상황을 기록합니다.',
    icon: BookOpen,
  },
];

const clonePolicies = (value) => JSON.parse(JSON.stringify(value));

export default function ExamPolicyTab() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [policies, setPolicies] = useState(defaultPolicies);
  const [savedPolicies, setSavedPolicies] = useState(defaultPolicies);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [saving, setSaving] = useState(false);
  const selectedExam = useMemo(() => exams.find((exam) => exam.id === examId), [exams, examId]);
  const hasChanges = useMemo(
    () => JSON.stringify(policies) !== JSON.stringify(savedPolicies),
    [policies, savedPolicies],
  );

  useEffect(() => {
    api.get('/supervisor/exams', { headers: authHeaders() }).then(({ data }) => {
      setExams(data);
      setExamId(data[0]?.id || '');
    }).catch((error) => {
      setMessageType('error');
      setMessage(apiErrorMessage(error, '시험 목록을 불러오지 못했습니다.'));
    });
  }, []);

  useEffect(() => {
    if (!examId) return;
    setMessage('');
    api.get(`/supervisor/exams/${examId}/policies`, { headers: authHeaders() })
      .then(({ data }) => {
        setPolicies(data);
        setSavedPolicies(clonePolicies(data));
      })
      .catch((error) => {
        setMessageType('error');
        setMessage(apiErrorMessage(error, 'AI 감지 설정을 불러오지 못했습니다.'));
      });
  }, [examId]);

  const updateDetection = (key, value) => {
    setMessage('');
    setPolicies((current) => ({
      ...current,
      cheatDetection: { ...current.cheatDetection, [key]: value },
    }));
  };

  const toggleAnalysis = (value) => {
    setMessage('');
    setPolicies((current) => ({ ...current, aiAnalysisEnabled: value }));
  };

  const cancelChanges = () => {
    setPolicies(clonePolicies(savedPolicies));
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.patch(`/supervisor/exams/${examId}/policies`, policies, { headers: authHeaders() });
      setPolicies(data);
      setSavedPolicies(clonePolicies(data));
      setMessageType('success');
      setMessage('시험 AI 감지 설정을 저장했습니다.');
    } catch (error) {
      setMessageType('error');
      setMessage(apiErrorMessage(error, 'AI 감지 설정 저장에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const detectionDisabled = !policies.aiAnalysisEnabled;

  return (
    <section className="workspace-shell exam-policy-workspace">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">AI PROCTORING</span>
          <h1>시험 AI 감지 설정</h1>
          <p>시험 중 감지할 의심 상황과 자동 경고 기록 여부를 설정합니다.</p>
        </div>
        <div className="exam-policy-save-state" data-dirty={hasChanges}>
          {hasChanges ? '저장하지 않은 변경사항' : <><Check size={15} /> 저장됨</>}
        </div>
      </div>

      {message && (
        <div className={`workspace-alert ${messageType === 'error' ? 'error' : 'exam-policy-success'}`} role="status">
          {messageType === 'success' && <Check size={16} />}
          {message}
        </div>
      )}

      <div className="exam-policy-layout">
        <section className="data-panel form-panel exam-policy-exam-card">
          <label>
            대상 시험
            <select value={examId} onChange={(event) => setExamId(event.target.value)}>
              <option value="">시험을 선택하세요</option>
              {exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title} ({exam.date})</option>)}
            </select>
          </label>
          {selectedExam && <p className="form-hint">{selectedExam.organizationName || '해당 조직'} · {selectedExam.title}</p>}
        </section>

        <section className="data-panel exam-policy-settings-card" aria-labelledby="ai-settings-title">
          <div className="exam-policy-section-heading">
            <span className="exam-policy-step">2</span>
            <div><h2 id="ai-settings-title">AI 영상 감지</h2><p>웹캠 화면을 분석해 의심 상황을 자동으로 기록합니다.</p></div>
          </div>

          <div className="exam-policy-master-toggle">
            <div className="exam-policy-master-copy">
              <span className="exam-policy-icon"><ShieldCheck size={21} /></span>
              <div><strong>AI 영상 감지 사용</strong><span>{policies.aiAnalysisEnabled ? '감지 항목이 실시간으로 분석됩니다.' : 'AI 분석과 자동 경고 기록이 중단됩니다.'}</span></div>
            </div>
            <label className="switch-control">
              <input type="checkbox" checked={policies.aiAnalysisEnabled} onChange={(event) => toggleAnalysis(event.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              <span className="sr-only">AI 영상 감지 사용</span>
            </label>
          </div>

          <div className={`exam-policy-detections ${detectionDisabled ? 'is-disabled' : ''}`}>
            <div className="exam-policy-list-heading"><h3>감지 및 경고 항목</h3><span>자동 기록</span></div>
            {detectionItems.map(({ key, label, description, icon: Icon }) => (
              <div className="exam-policy-detection-row" key={key}>
                <span className="exam-policy-icon subtle"><Icon size={19} /></span>
                <div className="exam-policy-detection-copy">
                  <strong>{label}</strong>
                  <span>{description}</span>
                </div>
                <label className="switch-control">
                  <input
                    type="checkbox"
                    disabled={detectionDisabled}
                    checked={policies.cheatDetection[key]}
                    onChange={(event) => updateDetection(key, event.target.checked)}
                  />
                  <span className="switch-track" aria-hidden="true" />
                  <span className="sr-only">{label} 자동 기록</span>
                </label>
              </div>
            ))}
          </div>

          <div className="exam-policy-actions">
            <button className="secondary-button" type="button" disabled={!hasChanges || saving} onClick={cancelChanges}>변경 취소</button>
            <button className="primary-button" type="button" disabled={!examId || !hasChanges || saving} onClick={save}>
              <Save size={16} /> {saving ? '저장 중...' : '이 시험에 적용'}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
