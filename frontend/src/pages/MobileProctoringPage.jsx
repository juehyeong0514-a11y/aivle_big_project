import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, Camera } from 'lucide-react';

export default function MobileProctoringPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const mobileVideoRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('유효하지 않은 접근입니다.');
      return;
    }
    const channel = new BroadcastChannel('exam_qr_channel');
    channel.postMessage({ type: 'QR_CONNECTED', token });
  }, [token]);

  const startFrontCamera = async () => {
    try {
      setErrorMsg('');
      await new Promise(resolve => setTimeout(resolve, 600));

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        });
      } catch (firstErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (mobileVideoRef.current) {
        mobileVideoRef.current.srcObject = stream;
        await mobileVideoRef.current.play();
      }
      setIsStarted(true);
    } catch (err) {
      console.error("NotReadableError caught:", err);
      setErrorMsg(`카메라 점유 충돌: 크롬을 새로고침 후 다시 시도해주세요.`);
    }
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
      <div style={{ width: '100%', padding: '10px 16px', backgroundColor: 'rgba(15, 23, 42, 0.95)', boxSizing: 'border-box', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold' }}>보조 카메라 실시간 모니터링</span>
          <span style={{ fontSize: '0.7rem', color: isStarted ? '#4ade80' : '#f59e0b' }}>
            {isStarted ? '연결 완료' : '대기 중'}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {errorMsg ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#f87171', margin: 'auto' }}>
            <AlertTriangle size={36} style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '0.95rem', margin: 0 }}>{errorMsg}</p>
          </div>
        ) : (
          <>
            <div style={{ width: '100%', flex: 1, backgroundColor: '#000', position: 'relative', minHeight: 0 }}>
              <video
                ref={mobileVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
              />

              {!isStarted && (
                <div style={{
                  position: 'absolute', inset: 0, backgroundColor: 'rgba(9, 13, 22, 0.92)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px', textAlign: 'center'
                }}>
                  <Camera size={42} color="#38bdf8" style={{ marginBottom: '10px' }} />
                  <h3 style={{ fontSize: '1rem', marginBottom: '6px', color: '#fff' }}>전면 카메라 모니터링 시작</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.3' }}>
                    주변 스캔이 완료되었습니다.<br/>버튼을 눌러 응시자 모니터링을 시작해주세요.
                  </p>
                  <button
                    onClick={startFrontCamera}
                    style={{
                      width: '80%', padding: '12px', backgroundColor: '#2563EB', color: '#fff',
                      border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold',
                      cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
                    }}
                  >
                    전면 카메라 켜기
                  </button>
                </div>
              )}
            </div>

            {isStarted && (
              <div style={{ margin: '10px', backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(74, 222, 128, 0.3)', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#4ade80', marginBottom: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  <ShieldCheck size={16} /> 실시간 부정행위 방지 모니터링 중
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.3' }}>
                  스마트폰을 측면 거치대에 고정하고 PC 화면으로 돌아가 주세요.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}