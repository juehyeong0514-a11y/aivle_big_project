import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function MobileScanPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('유효하지 않은 접근입니다.');
    }
  }, [token]);

  const goToProctoring = () => {
    window.location.href = `/mobile/proctoring?token=${token}`;
  };

  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#090d16',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      margin: 0,
      overflow: 'hidden'
    }}>
      <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box' }}>
        {errorMsg ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#f87171' }}>
            <AlertTriangle size={36} style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '0.95rem', margin: 0 }}>{errorMsg}</p>
          </div>
        ) : (
          <section style={{ width: '100%', maxWidth: '420px', padding: '24px', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '16px', backgroundColor: 'rgba(15, 23, 42, 0.96)', boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)' }}>
            <ShieldCheck size={38} color="#38bdf8" />
            <p style={{ margin: '16px 0 6px', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.08em' }}>AUXILIARY CAMERA</p>
            <h1 style={{ margin: 0, color: '#f8fafc', fontSize: '1.35rem' }}>보조 카메라 연결</h1>
            <p style={{ margin: '12px 0 16px', color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.55 }}>버튼을 누르면 시험 중 보조 카메라 연결을 시작합니다.</p>
            <div role="note" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(146, 64, 14, 0.3)', border: '1px solid rgba(251, 191, 36, 0.45)', color: '#fde68a', fontSize: '0.78rem', lineHeight: 1.5 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span><strong>시험 연결 유지 안내</strong><br />화면 잠금, 다른 앱 전환, 전화 수신, 브라우저 종료 또는 배터리 절약 모드에서는 카메라 전송이 중단될 수 있습니다. 시험이 끝날 때까지 이 화면을 켜두세요.</span>
            </div>
            <button type="button" onClick={goToProctoring} style={{ width: '100%', marginTop: '20px', padding: '13px', border: 0, borderRadius: '9px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}>보조 카메라 연결하기 <ArrowRight size={17} style={{ verticalAlign: 'middle' }} /></button>
          </section>
        )}
      </div>
    </div>
  );
}
