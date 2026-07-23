import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Lock, ArrowRight, UserCheck, ShieldAlert, Mail, UserPlus, LogIn, Eye } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';

export default function AuthPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('LOGIN'); // 'LOGIN' 또는 'SIGNUP'

  // 3대 권한 상태: 'APPLICANT'(응시자), 'SUPERVISOR'(감독관), 'ADMIN'(관리자)
  const [role, setRole] = useState('APPLICANT');

  // 입력값 상태 관리
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: ''
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 권한 선택 시 상태 초기화 (입력창 비우기)
  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setErrorMsg('');
    setSuccessMsg('');
    setFormData({ username: '', email: '', password: '', passwordConfirm: '' });
  };

  // 모드 변경 시 초기화
  const handleModeSelect = (mode) => {
    setAuthMode(mode);
    setErrorMsg('');
    setSuccessMsg('');
    setFormData({ username: '', email: '', password: '', passwordConfirm: '' });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
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
      try {
        await api.post('/auth/signup', {
          name: formData.username,
          email: formData.email,
          password: formData.password,
          role,
        });
        setAuthMode('LOGIN');
        setFormData({ username: '', email: formData.email, password: '', passwordConfirm: '' });
        setSuccessMsg('회원가입 성공! 가입한 계정으로 로그인해주세요.');
      } catch (error) {
        setErrorMsg(apiErrorMessage(error, '회원가입 중 오류가 발생했습니다.'));
      }
      return;
    }

    if (authMode === 'LOGIN') {
      // 🌟 로그인 모드에서도 이메일이나 비밀번호가 비어있으면 에러 발생
      if (!formData.email.trim() || !formData.password.trim()) {
        setErrorMsg('모든 항목을 빠짐없이 입력해주세요.');
        return;
      }

      try {
        const { data } = await api.post('/auth/login', {
          email: formData.email.trim(),
          password: formData.password.trim(),
          role,
        });
        localStorage.setItem('accessToken', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.name);

        if (role === 'ADMIN') navigate('/home?tab=EXAM_CREATE');
        else if (role === 'SUPERVISOR') navigate('/home?tab=LIVE_MONITORING');
        else navigate('/');
      } catch (error) {
        setErrorMsg(apiErrorMessage(error, '로그인 중 오류가 발생했습니다.'));
      }
    }
  };

  // 현재 선택된 권한에 따른 placeholder 이메일 결정
  const getPlaceholderEmail = () => {
    if (role === 'APPLICANT') return 'applicant@aivle.com';
    if (role === 'SUPERVISOR') return 'supervisor@aivle.com';
    return 'admin@aivle.com';
  };

  return (
    <div className="auth-container" style={{minHeight: 'calc(100vh - 64px)', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'}}>
      <div className="auth-box" style={{maxWidth: '480px', width: '100%', padding: '2.5rem', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)'}}>

        {/* 상단 로고 및 타이틀 */}
        <div className="auth-header" style={{textAlign: 'center', marginBottom: '1.75rem'}}>
          <div className="logo-icon" style={{width: 52, height: 52, backgroundColor: '#2563EB', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto'}}>
            <ShieldCheck color="#ffffff" size={30} />
          </div>
          <h1 style={{fontSize: '1.4rem', margin: '0 0 0.25rem 0', color: '#0f172a', fontWeight: 'bold'}}>AI 리터러시 역량 테스트 플랫폼</h1>
          <p style={{color: '#64748b', margin: 0, fontSize: '0.85rem'}}>실시간 지능형 감독 및 자동 평가 시스템</p>
        </div>

        {/* 모드 전환 탭 (로그인 / 회원가입) */}
        <div className="mode-tab-container" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem', backgroundColor: '#f1f5f9', padding: '0.35rem', borderRadius: '10px'}}>
          <button
            type="button"
            className={`mode-tab-btn ${authMode === 'LOGIN' ? 'active' : ''}`}
            onClick={() => handleModeSelect('LOGIN')}
            style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.6rem', border: 'none', borderRadius: '8px', backgroundColor: authMode === 'LOGIN' ? '#ffffff' : 'transparent', color: authMode === 'LOGIN' ? '#2563EB' : '#64748b', fontWeight: authMode === 'LOGIN' ? 'bold' : '500', cursor: 'pointer', boxShadow: authMode === 'LOGIN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}
          >
            <LogIn size={16} /><span>로그인</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${authMode === 'SIGNUP' ? 'active' : ''}`}
            onClick={() => handleModeSelect('SIGNUP')}
            style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.6rem', border: 'none', borderRadius: '8px', backgroundColor: authMode === 'SIGNUP' ? '#ffffff' : 'transparent', color: authMode === 'SIGNUP' ? '#2563EB' : '#64748b', fontWeight: authMode === 'SIGNUP' ? 'bold' : '500', cursor: 'pointer', boxShadow: authMode === 'SIGNUP' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}
          >
            <UserPlus size={16} /><span>회원가입</span>
          </button>
        </div>

        {/* 3대 권한 선택 탭 (응시자 / 감독관 / 시스템 관리자) */}
        <div className="role-tab-container" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '1.5rem'}}>
          <button
            type="button"
            onClick={() => handleRoleSelect('APPLICANT')}
            style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.5rem 0.2rem', border: role === 'APPLICANT' ? '2px solid #2563EB' : '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: role === 'APPLICANT' ? '#eff6ff' : '#ffffff', color: role === 'APPLICANT' ? '#2563EB' : '#64748b', fontWeight: role === 'APPLICANT' ? 'bold' : '500', fontSize: '0.75rem', cursor: 'pointer'}}
          >
            <UserCheck size={16} /><span>응시자</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect('SUPERVISOR')}
            style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.5rem 0.2rem', border: role === 'SUPERVISOR' ? '2px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: role === 'SUPERVISOR' ? '#f0fdf4' : '#ffffff', color: role === 'SUPERVISOR' ? '#16a34a' : '#64748b', fontWeight: role === 'SUPERVISOR' ? 'bold' : '500', fontSize: '0.75rem', cursor: 'pointer'}}
          >
            <Eye size={16} /><span>감독관</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleSelect('ADMIN')}
            style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '0.5rem 0.2rem', border: role === 'ADMIN' ? '2px solid #7c3aed' : '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: role === 'ADMIN' ? '#f5f3ff' : '#ffffff', color: role === 'ADMIN' ? '#7c3aed' : '#64748b', fontWeight: role === 'ADMIN' ? 'bold' : '500', fontSize: '0.75rem', cursor: 'pointer'}}
          >
            <ShieldAlert size={16} /><span>시스템 관리자</span>
          </button>
        </div>

        {/* 알림 메시지 */}
        {errorMsg && <div className="alert-box alert-error" style={{padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '6px', fontSize: '0.85rem'}}>{errorMsg}</div>}
        {successMsg && <div className="alert-box alert-success" style={{padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '6px', fontSize: '0.85rem'}}>{successMsg}</div>}

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          {authMode === 'SIGNUP' && (
            <div className="input-group" style={{margin: 0}}>
              <label className="input-label" style={{display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: '#334155'}}>이름 (실명)</label>
              <div className="input-wrapper" style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                <User size={18} color="#94a3b8" style={{position: 'absolute', left: '12px'}} />
                <input type="text" name="username" placeholder="홍길동" value={formData.username} onChange={handleChange} className="form-input" style={{width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem'}} />
              </div>
            </div>
          )}

          <div className="input-group" style={{margin: 0}}>
            <label className="input-label" style={{display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: '#334155'}}>
              {role === 'APPLICANT' ? '응시자 이메일' : role === 'SUPERVISOR' ? '감독관 이메일' : '관리자 이메일'}
            </label>
            <div className="input-wrapper" style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
              <Mail size={18} color="#94a3b8" style={{position: 'absolute', left: '12px'}} />
              <input
                type="text"
                name="email"
                placeholder={getPlaceholderEmail()}
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                style={{width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem'}}
              />
            </div>
          </div>

          <div className="input-group" style={{margin: 0}}>
            <label className="input-label" style={{display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: '#334155'}}>비밀번호</label>
            <div className="input-wrapper" style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
              <Lock size={18} color="#94a3b8" style={{position: 'absolute', left: '12px'}} />
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                style={{width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem'}}
              />
            </div>
          </div>

          {authMode === 'SIGNUP' && (
            <div className="input-group" style={{margin: 0}}>
              <label className="input-label" style={{display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: '#334155'}}>비밀번호 확인</label>
              <div className="input-wrapper" style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                <Lock size={18} color="#94a3b8" style={{position: 'absolute', left: '12px'}} />
                <input type="password" name="passwordConfirm" placeholder="••••••••" value={formData.passwordConfirm} onChange={handleChange} className="form-input" style={{width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem'}} />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{
              width: '100%',
              marginTop: '0.75rem',
              padding: '0.85rem',
              backgroundColor: role === 'APPLICANT' ? '#2563EB' : role === 'SUPERVISOR' ? '#16a34a' : '#7c3aed',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <span>{authMode === 'LOGIN' ? `${role === 'APPLICANT' ? '응시자' : role === 'SUPERVISOR' ? '감독관' : '관리자'} 로그인하기` : '회원가입 완료하기'}</span>
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