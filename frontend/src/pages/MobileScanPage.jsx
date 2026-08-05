import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function MobileScanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const mobileVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [step, setStep] = useState(1);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stepGuides = {
    1: { title: "Step 1: 책상 정면 및 상단", desc: "키보드, 마우스, 투명 물병을 제외한 책상 위 모든 사물을 치우고 촬영해주세요." },
    2: { title: "Step 2: 책상 아래 공간", desc: "휴대폰을 책상 아래로 향하게 하여 바닥과 다리 주변을 비춰주세요." },
    3: { title: "Step 3: 좌/우/후방 360도 전경", desc: "방 안의 벽면과 주변 공간을 천천히 360도 회전하며 비춰주세요." }
  };

  useEffect(() => {
    if (!token) {
      setErrorMsg('유효하지 않은 접근입니다.');
      return;
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [token]);

  const beginInspection = () => {
    setHasStarted(true);
    startCamera();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (mobileVideoRef.current) {
        mobileVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      setErrorMsg('카메라 권한이 거부되었거나 지원하지 않는 브라우저입니다.');
    }
  };

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setTimeout(() => {
        window.location.href = `/mobile/proctoring?token=${token}`;
      }, 300);
    }
  };

  return (
    <div style={{
      height: '100vh', // 🌟 화면 높이를 뷰포트에 고정
      backgroundColor: '#090d16',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      margin: 0,
      overflow: 'hidden' // 🌟 스크롤 원천 차단
    }}>
      {/* 상단 헤더 (압축형) */}
      <div style={{ width: '100%', padding: '10px 16px', backgroundColor: 'rgba(15, 23, 42, 0.95)', boxSizing: 'border-box', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold' }}>환경 사전 점검 ({step}/3 단계)</span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>진행 중</span>
        </div>
        <div style={{ width: '100%', height: '3px', backgroundColor: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${(step / 3) * 100}%`, height: '100%', backgroundColor: '#38bdf8', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* 중앙 콘텐츠 영역 (비디오와 가이드가 남은 공간을 유연하게 채움) */}
      <div style={{ width: '100%', flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {errorMsg ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#f87171', margin: 'auto' }}>
            <AlertTriangle size={36} style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '0.95rem', margin: 0 }}>{errorMsg}</p>
          </div>
        ) : !hasStarted ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box' }}>
            <section style={{ width: '100%', maxWidth: '420px', padding: '24px', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '16px', backgroundColor: 'rgba(15, 23, 42, 0.96)', boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)' }}>
              <ShieldCheck size={38} color="#38bdf8" />
              <p style={{ margin: '16px 0 6px', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.08em' }}>AUXILIARY CAMERA</p>
              <h1 style={{ margin: 0, color: '#f8fafc', fontSize: '1.35rem' }}>보조 카메라 검사 시작</h1>
              <p style={{ margin: '12px 0 16px', color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.55 }}>검사 시작 후 주변 환경을 3단계로 촬영한 다음, 시험 중 보조 카메라 연결을 시작합니다.</p>
              <div role="note" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(146, 64, 14, 0.3)', border: '1px solid rgba(251, 191, 36, 0.45)', color: '#fde68a', fontSize: '0.78rem', lineHeight: 1.5 }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span><strong>시험 연결 유지 안내</strong><br />화면 잠금, 다른 앱 전환, 전화 수신, 브라우저 종료 또는 배터리 절약 모드에서는 카메라 전송이 중단될 수 있습니다. 시험이 끝날 때까지 이 화면을 켜두세요.</span>
              </div>
              <button type="button" onClick={beginInspection} style={{ width: '100%', marginTop: '20px', padding: '13px', border: 0, borderRadius: '9px', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}>검사 시작하기 <ArrowRight size={17} style={{ verticalAlign: 'middle' }} /></button>
            </section>
          </div>
        ) : (
          <>
            {/* 비디오 화면: flex: 1을 주어 남은 공간을 모두 활용하되 찌그러지지 않게 처리 */}
            <div style={{ width: '100%', flex: 1, backgroundColor: '#000', position: 'relative', minHeight: 0 }}>
              <video ref={mobileVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>

            {/* 하단 고정 가이드 및 버튼 박스 */}
            <div style={{
              margin: '10px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              flexShrink: 0
            }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#f8fafc' }}>{stepGuides[step].title}</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.3' }}>{stepGuides[step].desc}</p>
              <button
                onClick={handleNextStep}
                style={{ width: '100%', padding: '10px', backgroundColor: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {step === 3 ? '점검 완료 및 전면 카메라 전환' : '다음 단계로 넘어가기'} <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
