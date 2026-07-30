import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle, RefreshCw, UploadCloud } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';

export default function MobileIdScanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [autoCaptureMessage, setAutoCaptureMessage] = useState('카메라를 준비하는 중입니다.');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    try {
      stopCamera();
      setCameraReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 900 }, aspectRatio: { ideal: 85.6 / 54 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setError('');
    } catch (reason) {
      setError('카메라를 사용할 수 없습니다. 브라우저의 카메라 권한을 허용해주세요.');
      console.error('ID card camera error:', reason);
    }
  };

  const captureFrame = useCallback((maximumWidth, quality) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return '';
    const scale = Math.min(1, maximumWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 QR 코드입니다. PC 검사 화면에서 QR 코드를 다시 열어주세요.');
      return undefined;
    }
    void startCamera();
    return stopCamera;
  }, [token]);

  const capture = useCallback(() => {
    const image = captureFrame(1600, 0.84);
    if (!image) {
      setError('카메라 화면이 준비된 뒤 다시 촬영해주세요.');
      return;
    }
    setCapturedImage(image);
    setAutoCaptureMessage('자동 촬영이 완료되었습니다. 사진을 확인한 뒤 생년월일 확인을 눌러주세요.');
    stopCamera();
  }, [captureFrame]);

  useEffect(() => {
    if (!token || !cameraReady || capturedImage) return undefined;
    let cancelled = false;
    let timerId;
    const detectCard = async () => {
      const image = captureFrame(900, 0.62);
      if (!image) return;
      setAutoCaptureMessage('가이드 안의 신분증을 찾고 있습니다.');
      try {
        const { data } = await api.post(`/mobile-id-scans/${encodeURIComponent(token)}/detect`, { image });
        if (cancelled) return;
        if (data.aligned) {
          setAutoCaptureMessage('신분증을 확인했습니다. 자동으로 촬영합니다.');
          capture();
          return;
        }
        setAutoCaptureMessage('신분증 전체가 가이드 중앙에 보이도록 맞춰주세요.');
      } catch (reason) {
        if (!cancelled) setError(apiErrorMessage(reason, '신분증 자동 감지를 시작하지 못했습니다. 수동으로 촬영해주세요.'));
        return;
      }
      if (!cancelled) timerId = window.setTimeout(detectCard, 2000);
    };
    timerId = window.setTimeout(detectCard, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [cameraReady, capture, captureFrame, capturedImage, token]);

  const retake = () => {
    setCapturedImage('');
    setVerification(null);
    setError('');
    setAutoCaptureMessage('카메라를 준비하는 중입니다.');
    void startCamera();
  };

  const submitCapture = async () => {
    if (!capturedImage || !token) return;
    setIsSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/mobile-id-scans/${encodeURIComponent(token)}/capture`, { image: capturedImage });
      setVerification(data);
    } catch (reason) {
      setError(apiErrorMessage(reason, '신분증 생년월일을 확인하지 못했습니다. 다시 촬영해주세요.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verification?.verified) {
    return (
      <main className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <CheckCircle size={48} color="var(--status-success)" style={{ margin: '0 auto 1rem' }} />
        <h1>신원확인 완료</h1>
        <p className="sub-description">등록된 이름과 생년월일이 일치합니다.<br />PC 검사 화면에서 다음 단계로 진행해주세요.</p>
      </main>
    );
  }

  return (
    <main className="container" style={{ padding: '1rem' }}>
      <button type="button" className="back-link" style={{ marginBottom: '1rem' }} onClick={() => navigate(-1)}><ArrowLeft size={16} /> 돌아가기</button>
      <h1>신분증 촬영</h1>
      <p className="sub-description" style={{ marginTop: 0 }}>휴대폰을 가로로 돌린 뒤 신분증 전체를 가이드 중앙에 맞춰주세요. 인식되면 자동으로 촬영합니다.</p>

      {error && <div className="alert-box alert-error">{error}</div>}
      {verification?.message && !verification.verified && <div className="alert-box alert-error">{verification.message}</div>}

      <div className="video-box identity-camera-box id-card-mobile-camera">
        {capturedImage ? (
          <img src={capturedImage} alt="촬영한 신분증" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="video-stream" onLoadedMetadata={() => setCameraReady(true)} />
            <div className="id-card-guide">
              <div className="id-card-guide-frame" style={{ width: '85%', height: 'auto', aspectRatio: '85.6 / 54' }} />
              <span>신분증을 가이드 안에 맞춰주세요.</span>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {!capturedImage && <p className="form-hint" style={{ textAlign: 'center', marginTop: 0 }}>{autoCaptureMessage}</p>}

      {capturedImage ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="secondary-button" style={{ minHeight: '50px' }} onClick={retake} disabled={isSubmitting}><RefreshCw size={18} /> 다시 촬영</button>
          <button type="button" className="primary-button" style={{ minHeight: '50px' }} onClick={submitCapture} disabled={isSubmitting}><UploadCloud size={18} /> {isSubmitting ? '확인 중...' : '생년월일 확인'}</button>
        </div>
      ) : (
        <button type="button" className="primary-button identity-full-button" style={{ minHeight: '60px', marginTop: '1rem' }} onClick={capture}><Camera size={20} /> 촬영하기</button>
      )}
    </main>
  );
}
