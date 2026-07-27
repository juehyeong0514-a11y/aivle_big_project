import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';

export default function StaffSignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendVerification = async () => {
    setError('');
    try {
      const { data } = await api.post('/auth/email-verification/send', { email: form.email });
      setVerificationId(data.verificationId);
      setVerificationToken('');
      setMessage(data.deliveryStatus === 'PREVIEW' ? `개발용 인증번호: ${data.previewCode}` : '인증번호를 이메일로 보냈습니다.');
    } catch (reason) {
      setError(apiErrorMessage(reason, '인증번호를 보내지 못했습니다.'));
    }
  };

  const confirmVerification = async () => {
    setError('');
    try {
      const { data } = await api.post('/auth/email-verification/confirm', { email: form.email, verificationId, code: verificationCode });
      setVerificationToken(data.verificationToken);
      setMessage('이메일 인증이 완료되었습니다. 가입 신청을 진행하세요.');
    } catch (reason) {
      setError(apiErrorMessage(reason, '인증번호를 확인하지 못했습니다.'));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!verificationToken) {
      setError('먼저 이메일 인증번호를 확인해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/signup', { ...form, verificationToken });
      navigate('/login', { replace: true, state: { message: '회원가입 신청이 완료되었습니다. ADMIN 승인 후 로그인할 수 있습니다.' } });
    } catch (reason) {
      setError(apiErrorMessage(reason, '회원가입 신청에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return <main className="auth-container"><div className="auth-box staff-auth"><button type="button" className="auth-home-button" onClick={() => navigate('/')}><ArrowLeft size={16} /> 홈으로</button><div className="auth-header"><div className="logo-icon"><ShieldCheck color="#ffffff" size={28} /></div><h1>운영자 회원가입</h1><p>이메일 인증 후 가입을 신청하면 ADMIN 승인 뒤 계정을 사용할 수 있습니다.</p></div>{error && <div className="workspace-alert error">{error}</div>}{message && <div className="workspace-alert">{verificationToken && <CheckCircle2 size={16} />} {message}</div>}<form onSubmit={submit} className="staff-login-form"><label>이름<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" required /></label><label>이메일<div className="input-with-action"><input type="email" value={form.email} onChange={(event) => { setForm({ ...form, email: event.target.value }); setVerificationToken(''); }} placeholder="manager@aivle.com" autoComplete="email" required /><button type="button" className="btn-secondary compact-button" onClick={sendVerification} disabled={!form.email || Boolean(verificationToken)}><Mail size={15} /> 인증번호 발송</button></div></label>{verificationId && !verificationToken && <label>인증번호<input inputMode="numeric" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6자리 인증번호" maxLength={6} required /><button type="button" className="btn-secondary" onClick={confirmVerification} disabled={verificationCode.length !== 6}>인증번호 확인</button></label>}<label>비밀번호<div className="input-with-icon"><LockKeyhole size={17} /><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="8자 이상" autoComplete="new-password" minLength={8} required /></div></label><button className="primary-button" type="submit" disabled={loading || !verificationToken}>{loading ? '신청 중...' : <>회원가입 신청 <ArrowRight size={17} /></>}</button></form><p className="auth-note">이미 계정이 있으신가요? <Link to="/login">로그인</Link></p></div></main>;
}
