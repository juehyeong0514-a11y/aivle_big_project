import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Lock, ArrowRight, UserCheck, ShieldAlert, Mail, UserPlus, LogIn } from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('LOGIN');
  const [role, setRole] = useState('APPLICANT');
  const [formData, setFormData] = useState({ username: '', email: '', password: '', passwordConfirm: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (authMode === 'SIGNUP') {
      if (!formData.username || !formData.email || !formData.password || !formData.passwordConfirm) {
        setErrorMsg('모든 항목을 빠짐없이 입력해주세요.'); return;
      }
      if (formData.password !== formData.passwordConfirm) {
        setErrorMsg('비밀번호가 일치하지 않습니다.'); return;
      }
      alert(`[${role === 'APPLICANT' ? '응시자' : '관리자/감독관'}] 회원가입이 완료되었습니다!`);
      setSuccessMsg('회원가입 성공! 가입한 계정으로 로그인해주세요.');
      setAuthMode('LOGIN');
      setFormData((prev) => ({ ...prev, password: '', passwordConfirm: '' }));
      return;
    }

    if (authMode === 'LOGIN') {
      if (!formData.email || !formData.password) {
        setErrorMsg('이메일과 비밀번호를 입력해주세요.'); return;
      }
      localStorage.setItem('userRole', role);
      localStorage.setItem('userEmail', formData.email);
      alert(`[${role === 'APPLICANT' ? '응시자' : '감독관/관리자'}] 계정으로 로그인되었습니다.`);
      navigate('/home', { state: { role: role } });
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        {/* 상단 로고 및 타이틀 */}
        <div className="auth-header">
          <div className="logo-icon" style={{width: 60, height: 60, marginBottom: '0.75rem'}}>
            <ShieldCheck color="#ffffff" size={36} />
          </div>
          <h1 style={{fontSize: '1.4rem', margin: '0 0 0.25rem 0'}}>AI 리터러시 역량 테스트</h1>
          <p style={{color: '#64748b', margin: 0, fontSize: '0.85rem'}}>실시간 지능형 감독 및 자동 평가 플랫폼</p>
        </div>

        {/* 모드 전환 탭 */}
        <div className="mode-tab-container">
          <button
            type="button"
            className={`mode-tab-btn ${authMode === 'LOGIN' ? 'active' : ''}`}
            onClick={() => { setAuthMode('LOGIN'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <LogIn size={18} /><span>로그인</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${authMode === 'SIGNUP' ? 'active' : ''}`}
            onClick={() => { setAuthMode('SIGNUP'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            <UserPlus size={18} /><span>회원가입</span>
          </button>
        </div>

        {/* 권한 선택 탭 */}
        <div className="role-tab-container">
          <button
            type="button"
            className={`role-tab-btn ${role === 'APPLICANT' ? 'active' : ''}`}
            onClick={() => { setRole('APPLICANT'); setErrorMsg(''); }}
          >
            <UserCheck size={16} /><span>응시자 {authMode === 'LOGIN' ? '접속' : '가입'}</span>
          </button>
          <button
            type="button"
            className={`role-tab-btn ${role === 'ADMIN' ? 'active' : ''}`}
            onClick={() => { setRole('ADMIN'); setErrorMsg(''); }}
          >
            <ShieldAlert size={16} /><span>감독관/관리자 {authMode === 'LOGIN' ? '접속' : '가입'}</span>
          </button>
        </div>

        {/* 알림 메시지 */}
        {errorMsg && <div className="alert-box alert-error">{errorMsg}</div>}
        {successMsg && <div className="alert-box alert-success">{successMsg}</div>}

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit}>
          {authMode === 'SIGNUP' && (
            <div className="input-group">
              <label className="input-label">이름 (실명)</label>
              <div className="input-wrapper">
                <User size={18} color="#94a3b8" className="input-icon" />
                <input type="text" name="username" placeholder="홍길동" value={formData.username} onChange={handleChange} className="form-input" />
              </div>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">
              {role === 'APPLICANT' ? '응시자 이메일 (또는 수험번호)' : '관리자 이메일'}
            </label>
            <div className="input-wrapper">
              <Mail size={18} color="#94a3b8" className="input-icon" />
              <input type="text" name="email" placeholder={role === 'APPLICANT' ? "applicant@test.com" : "admin@test.com"} value={formData.email} onChange={handleChange} className="form-input" />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">비밀번호</label>
            <div className="input-wrapper">
              <Lock size={18} color="#94a3b8" className="input-icon" />
              <input type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} className="form-input" />
            </div>
          </div>

          {authMode === 'SIGNUP' && (
            <div className="input-group">
              <label className="input-label">비밀번호 확인</label>
              <div className="input-wrapper">
                <Lock size={18} color="#94a3b8" className="input-icon" />
                <input type="password" name="passwordConfirm" placeholder="••••••••" value={formData.passwordConfirm} onChange={handleChange} className="form-input" />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '0.5rem'}}>
            <span>{authMode === 'LOGIN' ? '로그인 및 입장하기' : '회원가입 완료하기'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center'}}>
          {authMode === 'LOGIN' ? (
            <span>계정이 없으신가요? 상단의 <strong>[회원가입]</strong> 탭을 눌러 가입하세요.</span>
          ) : (
            <span>이미 계정이 있으신가요? 상단의 <strong>[로그인]</strong> 탭을 눌러 접속하세요.</span>
          )}
        </div>
      </div>
    </div>
  );
}