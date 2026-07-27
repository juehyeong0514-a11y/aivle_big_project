import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Hash, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';

export default function InvitePage() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = pathToken || searchParams.get('token') || '';
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [candidateNumber, setCandidateNumber] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('초대 링크가 올바르지 않습니다. 이메일의 링크를 다시 확인해주세요.');
      setLoading(false);
      return;
    }
    api.get(`/invitations/${token}`)
      .then(({ data }) => setInvite(data))
      .catch((reason) => setError(apiErrorMessage(reason, '초대 링크를 확인하지 못했습니다.')))
      .finally(() => setLoading(false));
  }, [token]);

  const verify = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post(`/invitations/${token}/verify`, { candidateNumber: candidateNumber.trim() });
      localStorage.setItem('candidateAccessToken', data.accessToken);
      localStorage.setItem('candidateNumber', data.candidateNumber);
      setVerified(true);
    } catch (reason) {
      setError(apiErrorMessage(reason, '응시번호를 확인하지 못했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="invite-page"><div className="invite-card"><div className="invite-icon"><ShieldCheck size={30} /></div><span className="workspace-eyebrow">INVITATION ONLY</span><h1>시험 입장</h1>{loading && <p className="invite-lead">초대 정보를 확인하는 중입니다.</p>}{error && <div className="workspace-alert error"><AlertTriangle size={16} /> {error}</div>}{invite && !verified && <><p className="invite-lead">초대 메일의 응시번호를 입력하면 본인 확인 후 사전 환경 점검으로 이동합니다.</p><dl className="invite-details"><div><dt>조직</dt><dd>{invite.organizationName}</dd></div><div><dt>시험명</dt><dd>{invite.examName}</dd></div><div><dt>시험 일정</dt><dd>{invite.schedule}</dd></div><div><dt>제한 시간 · 문항</dt><dd>{invite.duration} · {invite.questions}</dd></div><div><dt><Clock3 size={14} /> 링크 만료</dt><dd>{new Date(invite.expiresAt).toLocaleString('ko-KR')}</dd></div></dl><div className="workspace-alert"><AlertTriangle size={16} /> 입장 전 웹캠·마이크·화면 공유 환경을 점검해주세요.</div><form onSubmit={verify} className="invite-form"><label>응시번호<div className="input-with-icon"><Hash size={17} /><input value={candidateNumber} onChange={(event) => setCandidateNumber(event.target.value.toUpperCase())} placeholder="AIVLE-1001" autoComplete="off" required /></div></label><button className="primary-button" type="submit" disabled={submitting}>{submitting ? '확인 중...' : <>응시번호 확인하고 입장 <ArrowRight size={17} /></>}</button></form></>}{invite && verified && <div className="invite-success"><CheckCircle2 size={28} /><h2>응시번호가 확인되었습니다.</h2><p>시험 안내와 사전 환경 점검을 완료한 뒤 시험에 입장하세요.</p><button className="primary-button" onClick={() => navigate('/exam/check')}><ArrowRight size={17} /> 사전 환경 점검 시작</button></div>}</div></main>;
}
