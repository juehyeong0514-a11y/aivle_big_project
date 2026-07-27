import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';

export default function StaffSignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' });
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');

  // 약관 동의 상태
  const [allAgreed, setAllAgreed] = useState(false);
  const [agreedToService, setAgreedToService] = useState(false); // [필수] 서비스 이용약관
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false); // [필수] 개인정보 수집 및 이용
  const [agreedToMarketing, setAgreedToMarketing] = useState(false); // [선택] 마케팅 수신

  // 약관 상세 내용 펼쳐보기 토글 상태
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 비밀번호 검증 규칙 (8자 이상, 영문/숫자/특수문자 포함)
  const validatePassword = (pwd) => {
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/;
    return passwordRegex.test(pwd);
  };

  // 전체 동의 핸들러
  const handleAllAgreeChange = (e) => {
    const checked = e.target.checked;
    setAllAgreed(checked);
    setAgreedToService(checked);
    setAgreedToPrivacy(checked);
    setAgreedToMarketing(checked);
  };

  const updateAllAgreeStatus = (service, privacy, marketing) => {
    setAllAgreed(service && privacy && marketing);
  };

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
    if (!validatePassword(form.password)) {
      setError('비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!agreedToService || !agreedToPrivacy) {
      setError('필수 개인정보 수집·이용 및 서비스 약관에 동의해주세요.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/auth/signup', {
        name: form.name,
        email: form.email,
        password: form.password,
        verificationToken,
        agreedToPrivacy,
        agreedToMarketing
      });
      navigate('/login', { replace: true, state: { message: '회원가입 신청이 완료되었습니다. ADMIN 승인 후 로그인할 수 있습니다.' } });
    } catch (reason) {
      setError(apiErrorMessage(reason, '회원가입 신청에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-container">
      <div className="auth-box staff-auth" style={{ maxWidth: '540px' }}>
        <button type="button" className="auth-home-button" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> 홈으로
        </button>

        <div className="auth-header">
          <div className="logo-icon">
            <ShieldCheck color="#ffffff" size={24} />
          </div>
          <h1>운영자 회원가입</h1>
          <p>개인정보보호법 및 규제 가이드에 따라 안전하게 가입을 진행합니다.</p>
        </div>

        {error && <div className="workspace-alert error">{error}</div>}
        {message && (
          <div className="workspace-alert">
            {verificationToken && <CheckCircle2 size={16} />} {message}
          </div>
        )}

        <form onSubmit={submit} className="staff-login-form">
          <label>
            이름
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              autoComplete="name"
              placeholder="이름 입력"
              required
            />
          </label>

          <label>
            이메일
            <div className="input-with-action">
              <input
                type="email"
                value={form.email}
                onChange={(event) => { setForm({ ...form, email: event.target.value }); setVerificationToken(''); }}
                placeholder="manager@aivle.com"
                autoComplete="email"
                required
              />
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={sendVerification}
                disabled={!form.email || Boolean(verificationToken)}
              >
                <Mail size={15} /> 인증번호 발송
              </button>
            </div>
          </label>

          {verificationId && !verificationToken && (
            <label>
              인증번호
              <div className="input-with-action">
                <input
                  inputMode="numeric"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6자리 인증번호"
                  maxLength={6}
                  required
                />
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={confirmVerification}
                  disabled={verificationCode.length !== 6}
                >
                  인증번호 확인
                </button>
              </div>
            </label>
          )}

          <label>
            비밀번호
            <div className="input-with-icon">
              <LockKeyhole size={17} />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="8자 이상 (영문/숫자/특수문자 조합)"
                autoComplete="new-password"
                required
              />
            </div>
          </label>

          <label>
            비밀번호 확인
            <div className="input-with-icon">
              <LockKeyhole size={17} />
              <input
                type="password"
                value={form.passwordConfirm}
                onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value })}
                placeholder="비밀번호 재입력"
                autoComplete="new-password"
                required
              />
            </div>
          </label>

          {/* 약관 및 동의 영역 */}
          <div style={{ margin: '14px 0', padding: '14px', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: '10px', background: 'var(--surface-soft, #f1f5f9)' }}>

            {/* 전체 동의 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid var(--border-default, #e2e8f0)' }}>
              <input
                type="checkbox"
                id="all-agree"
                checked={allAgreed}
                onChange={handleAllAgreeChange}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary, #2563eb)', cursor: 'pointer' }}
              />
              <label htmlFor="all-agree" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary, #0f172a)', cursor: 'pointer' }}>
                전체 동의하기
              </label>
            </div>
            <p style={{ margin: '6px 0 10px 26px', fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
              필수 및 선택 약관에 모두 동의합니다.
            </p>

            {/* [필수] 서비스 이용약관 (상세 규정 추가) */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="service-agree"
                    checked={agreedToService}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAgreedToService(val);
                      updateAllAgreeStatus(val, agreedToPrivacy, agreedToMarketing);
                    }}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary, #2563eb)', cursor: 'pointer' }}
                  />
                  <label htmlFor="service-agree" style={{ fontSize: '13px', color: 'var(--text-secondary, #475569)', cursor: 'pointer', fontWeight: '600' }}>
                    [필수] 서비스 이용약관 동의
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setShowServiceDetails(!showServiceDetails)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary, #2563eb)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '12px' }}
                >
                  {showServiceDetails ? '닫기' : '보기'} {showServiceDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showServiceDetails && (
                <div style={{ marginTop: '6px', padding: '10px', background: '#ffffff', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted, #64748b)', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto' }}>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>제1조 (목적)</p>
                  <p style={{ margin: '0 0 6px 0' }}>본 약관은 AI 리터러시 역량 테스트 플랫폼이 제공하는 모든 서비스의 이용 조건 및 절차, 이용자와 플랫폼 간의 권리 및 책임사항을 규정함을 목적으로 합니다.</p>

                  <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>제2조 (계정 관리 및 의무)</p>
                  <p style={{ margin: '0 0 6px 0' }}>운영자 계정은 관리자(ADMIN)의 승인 후에 활성화되며, 계정 정보의 보안 유지 책임은 이용자에게 있습니다.</p>

                  <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>제3조 (서비스 이용 제한)</p>
                  <p style={{ margin: '0' }}>부정한 방법으로 가입을 시도하거나 시스템 보안을 위협하는 행위가 적발될 경우 계정 이용이 제한될 수 있습니다.</p>
                </div>
              )}
            </div>

            {/* [필수] 개인정보 수집 및 이용 동의 */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="privacy-agree"
                    checked={agreedToPrivacy}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAgreedToPrivacy(val);
                      updateAllAgreeStatus(agreedToService, val, agreedToMarketing);
                    }}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary, #2563eb)', cursor: 'pointer' }}
                  />
                  <label htmlFor="privacy-agree" style={{ fontSize: '13px', color: 'var(--text-secondary, #475569)', cursor: 'pointer', fontWeight: '600' }}>
                    [필수] 개인정보 수집 및 이용 동의
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary, #2563eb)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '12px' }}
                >
                  {showPrivacyDetails ? '닫기' : '보기'} {showPrivacyDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showPrivacyDetails && (
                <div style={{ marginTop: '6px', padding: '10px', background: '#ffffff', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted, #64748b)', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto' }}>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>[개인정보 수집·이용 내역]</p>
                  - 수집 목적: 운영자 계정 생성, 권한 승인 및 플랫폼 서비스 제공<br/>
                  - 수집 항목: 이름, 이메일, 비밀번호<br/>
                  - 보유 및 이용 기간: 회원 탈퇴 또는 승인 거절 시 즉시 파기 (단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관)<br/>
                  ※ 정보주체는 개인정보 수집·이용 동의를 거부할 권리가 있으나, 거부 시 회원가입이 제한됩니다.
                </div>
              )}
            </div>

            {/* [선택] 마케팅 정보 수신 동의 */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="marketing-agree"
                checked={agreedToMarketing}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAgreedToMarketing(val);
                  updateAllAgreeStatus(agreedToService, agreedToPrivacy, val);
                }}
                style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary, #2563eb)', cursor: 'pointer' }}
              />
              <label htmlFor="marketing-agree" style={{ fontSize: '13px', color: 'var(--text-secondary, #475569)', cursor: 'pointer' }}>
                [선택] 이벤트 및 플랫폼 공지 등 정보 수신 동의
              </label>
            </div>

          </div>

          <button className="primary-button" type="submit" disabled={loading || !verificationToken || !agreedToService || !agreedToPrivacy} style={{ width: '100%', marginTop: '0.5rem' }}>
            {loading ? '신청 중...' : <>회원가입 신청 <ArrowRight size={17} /></>}
          </button>
        </form>

        <p className="auth-note">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </main>
  );
}