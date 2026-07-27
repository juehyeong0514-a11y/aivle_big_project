import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';

export default function StaffAuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('userRole', data.user.role);
      localStorage.setItem('userEmail', data.user.email);
      localStorage.setItem('userName', data.user.name);
      navigate('/home?tab=HOME');
    } catch (reason) {
      setError(apiErrorMessage(reason, '이메일 또는 비밀번호를 확인해주세요.'));
    } finally {
      setLoading(false);
    }
  };

  return <main className="auth-container"><div className="auth-box staff-auth"><button type="button" className="auth-home-button" onClick={() => navigate('/')}><ArrowLeft size={16} /> 홈으로</button><div className="auth-header"><div className="logo-icon"><ShieldCheck color="#ffffff" size={28} /></div><h1>운영자 로그인</h1><p>승인된 운영자 계정으로 로그인하세요.</p></div>{error && <div className="workspace-alert error">{error}</div>}<form onSubmit={submit} className="staff-login-form"><label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="manager@aivle.com" autoComplete="email" required /></label><label>비밀번호<div className="input-with-icon"><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" autoComplete="current-password" required /></div></label><button className="primary-button" type="submit" disabled={loading}>{loading ? '로그인 중...' : <>로그인 <ArrowRight size={17} /></>}</button></form><p className="auth-note">운영자 계정이 없으신가요? <Link to="/signup">회원가입 신청</Link></p><p className="auth-note">응시자는 초대 메일의 시험 입장 링크를 이용하세요.</p></div></main>;
}
