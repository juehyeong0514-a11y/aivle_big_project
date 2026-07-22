import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export default function MobileScanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const mobileVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [step, setStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  const stepGuides = {
    1: { title: "Step 1: 책상 정면 및 상단", desc: "키보드, 마우스, 투명 물병을 제외한 책상 위 모든 사물을 치우고 촬영해주세요." },
    2: { title: "Step 2: 책상 아래 공간", desc: "휴대폰을 책상 아래로 향하게 하여 바닥과 다리 주변을 비춰주세요." },
    3: { title: "Step 3: 좌/우/후방 360도 전경", desc: "방 안의 벽면과 주변 공간을 천천히 360도 회전하며 비춰주세요." },
    4: { title: "Step 4: 모니터 테두리 & 반사 검사", desc: "모니터 테두리나 주변에 메모지나 서류가 없는지 가까이서 확인시켜주세요." }
  };

  useEffect(() => {
    if (!token) {
      setErrorMsg('유효하지 않은 접근입니다.');
      return;
    }
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [token]);

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
    if (step < 4) {
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
          <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold' }}>환경 사전 점검 ({step}/4 단계)</span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>진행 중</span>
        </div>
        <div style={{ width: '100%', height: '3px', backgroundColor: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${(step / 4) * 100}%`, height: '100%', backgroundColor: '#38bdf8', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* 중앙 콘텐츠 영역 (비디오와 가이드가 남은 공간을 유연하게 채움) */}
      <div style={{ width: '100%', flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {errorMsg ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#f87171', margin: 'auto' }}>
            <AlertTriangle size={36} style={{ marginBottom: '10px' }} />
            <p style={{ fontSize: '0.95rem', margin: 0 }}>{errorMsg}</p>
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
                {step === 4 ? '점검 완료 및 전면 카메라 전환' : '다음 단계로 넘어가기'} <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}