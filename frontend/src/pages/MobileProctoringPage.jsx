import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, Camera } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { startMobileLiveMonitoring } from '../applicant/mobileLiveMonitoring';
import { mirrorDetectionBox, normalizeAiMonitoring, projectDetectionBoxToCover } from '../supervisor/aiMonitoring.mjs';

export default function MobileProctoringPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const mobileVideoRef = useRef(null);
  const streamRef = useRef(null);
  const stopMonitoringRef = useRef(null);
  const [isStarted, setIsStarted] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [examEnded, setExamEnded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [aiMonitoring, setAiMonitoring] = useState(null);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(9 / 16);

  useEffect(() => {
    setDeviceReady(false);
    sessionStorage.removeItem('auxiliaryDeviceToken');
    if (!token) {
      setErrorMsg('유효하지 않은 접근입니다.');
      return;
    }
    let active = true;
    api.post('/mobile-devices/pair', { token })
      .then(({ data }) => {
        if (active) {
          sessionStorage.setItem('auxiliaryDeviceToken', data.deviceToken);
          setDeviceReady(true);
        }
      })
      .catch((error) => active && setErrorMsg(apiErrorMessage(error, '보조 카메라 QR 연결에 실패했습니다. PC에서 새 QR 코드를 생성해주세요.')));
    return () => {
      active = false;
      stopMonitoringRef.current?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const deviceToken = sessionStorage.getItem('auxiliaryDeviceToken');
      if (deviceToken) {
        void fetch(`${api.defaults.baseURL}/mobile-devices/${encodeURIComponent(deviceToken)}/disconnect`, {
          method: 'POST',
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [token]);

  useEffect(() => {
    if (!deviceReady || !isStarted || examEnded) return undefined;
    let active = true;
    const checkExamStatus = () => {
      const deviceToken = sessionStorage.getItem('auxiliaryDeviceToken');
      if (!deviceToken) return;
      api.get('/mobile-devices/' + deviceToken + '/status')
        .then(({ data }) => {
          if (!active) return;
          setAiMonitoring(normalizeAiMonitoring({ ai: data.ai }));
          if (!data.ended) return;
          stopMonitoringRef.current?.();
          stopMonitoringRef.current = null;
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setIsStarted(false);
          setExamEnded(true);
          setErrorMsg('');
          setAiMonitoring(null);
        })
        .catch(() => {});
    };
    checkExamStatus();
    const timer = window.setInterval(checkExamStatus, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [deviceReady, examEnded, isStarted]);

  useEffect(() => {
    if (!isStarted) return undefined;
    const updatePreviewAspectRatio = () => {
      const video = mobileVideoRef.current;
      if (video?.clientWidth && video.clientHeight) setPreviewAspectRatio(video.clientWidth / video.clientHeight);
    };
    updatePreviewAspectRatio();
    window.addEventListener('resize', updatePreviewAspectRatio);
    return () => window.removeEventListener('resize', updatePreviewAspectRatio);
  }, [isStarted]);

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
        console.warn('전면 카메라(facingMode: user) 접근 실패, 기본 비디오로 재시도합니다.', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (mobileVideoRef.current) {
        mobileVideoRef.current.srcObject = stream;
        await mobileVideoRef.current.play();
      }
      const deviceToken = sessionStorage.getItem('auxiliaryDeviceToken');
      if (!deviceToken) throw new Error('보조 카메라 연결 정보를 찾을 수 없습니다.');
      streamRef.current = stream;
      stopMonitoringRef.current?.();
      stopMonitoringRef.current = startMobileLiveMonitoring(deviceToken, stream, mobileVideoRef.current);
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

      <div role="note" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '10px 12px 0', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(146, 64, 14, 0.28)', border: '1px solid rgba(251, 191, 36, 0.45)', color: '#fde68a', fontSize: '0.72rem', lineHeight: 1.45, flexShrink: 0 }}>
        <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span><strong>연결 유지 안내</strong><br />화면 잠금, 다른 앱 전환, 전화 수신, 브라우저 종료 또는 배터리 절약 모드에서는 카메라 전송이 중단될 수 있습니다. 시험이 끝날 때까지 이 화면을 켜두세요.</span>
      </div>

      <div style={{ width: '100%', flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {examEnded ? (
          <div style={{ margin: 'auto', padding: '32px 24px', textAlign: 'center', color: '#e2e8f0' }}>
            <ShieldCheck size={48} color="#4ade80" style={{ marginBottom: '14px' }} />
            <h1 style={{ margin: '0 0 10px', fontSize: '1.35rem', color: '#f8fafc' }}>시험이 종료되었습니다.</h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.55 }}>보조 카메라 연결과 영상 전송이 안전하게 종료되었습니다.<br />이 창은 닫아도 됩니다.</p>
          </div>
        ) : errorMsg ? (
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
              {isStarted && aiMonitoring?.detections.length ? <MobileDetectionOverlay detections={aiMonitoring.detections} sourceAspectRatio={aiMonitoring.sourceAspectRatio} targetAspectRatio={previewAspectRatio} /> : null}
              {isStarted && aiMonitoring?.analyzedAt && <time className="mobile-proctor-ai-time" dateTime={aiMonitoring.analyzedAt}>AI 분석 {new Date(aiMonitoring.analyzedAt).toLocaleTimeString('ko-KR')}</time>}

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
                    disabled={!deviceReady}
                    style={{
                      width: '80%', padding: '12px', backgroundColor: '#2563EB', color: '#fff',
                      border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold',
                      cursor: deviceReady ? 'pointer' : 'wait', opacity: deviceReady ? 1 : .6, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
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

function MobileDetectionOverlay({ detections, sourceAspectRatio, targetAspectRatio }) {
  return <div className="monitoring-detection-overlay mobile-proctor-detection-overlay" aria-label={`AI 객체 탐지 ${detections.length}건`}>{detections.map((detection) => {
    const projected = projectDetectionBoxToCover(detection.bbox, sourceAspectRatio, targetAspectRatio);
    if (!projected) return null;
    const [x1, y1, x2, y2] = mirrorDetectionBox(projected);
    return <span className={'monitoring-detection-box detection-' + detection.label.replace(/\s+/g, '-') + (x1 > .65 ? ' edge-right' : '')} key={detection.id} style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}><b>{detection.displayLabel} {Math.round(detection.confidence * 100)}%</b></span>;
  })}</div>;
}
