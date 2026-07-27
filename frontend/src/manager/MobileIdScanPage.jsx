import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle, UploadCloud } from 'lucide-react';

export default function MobileIdScanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('잘못된 접근입니다. PC 화면의 QR 코드를 다시 스캔해주세요.');
      return;
    }
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [token]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError('카메라를 열 수 없습니다. 브라우저의 카메라 권한을 확인해주세요.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
  };

  const sendImageToPC = () => {
    if (!capturedImage || !token) return;
    try {
      const channel = new BroadcastChannel('exam_qr_channel');
      channel.postMessage({ type: 'ID_CARD_CAPTURED', token: token, image: capturedImage });
      channel.close();
      setIsSent(true);
    } catch (e) {
      setError('이미지를 PC로 전송하지 못했습니다. PC와 같은 기기, 같은 브라우저인지 확인해주세요.');
    }
  };

  if (error) {
    return <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <h2 style={{ color: '#dc2626' }}>오류</h2>
      <p>{error}</p>
      <button className="primary-button" onClick={() => navigate('/')}>홈으로</button>
    </div>;
  }

  if (isSent) {
    return <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <CheckCircle size={48} color="#16a34a" style={{ margin: '0 auto 1rem' }} />
      <h2>전송 완료</h2>
      <p>신분증 사진이 PC로 전송되었습니다.<br />이제 PC 화면에서 다음 단계를 진행해주세요.</p>
    </div>;
  }

  return (
    <div className="container" style={{ padding: '1rem' }}>
      <button className="back-link" style={{ marginBottom: '1rem' }} onClick={() => navigate(-1)}><ArrowLeft size={16} /> 뒤로</button>
      <h1>신분증 촬영</h1>
      <p className="sub-description" style={{ marginTop: 0 }}>신분증을 가이드라인에 맞춰 선명하게 촬영해주세요.</p>

      <div className="video-box identity-camera-box" style={{ height: 'auto', minHeight: '250px', aspectRatio: '16/9' }}>
        {capturedImage ? (
          <img src={capturedImage} alt="촬영된 신분증" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline className="video-stream" />
            <div className="id-card-guide">
              <div className="id-card-guide-frame" style={{ width: '85%', height: 'auto', aspectRatio: '85.6 / 54' }} />
              <span>신분증을 가이드 안에 맞춰주세요.</span>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {capturedImage ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <button className="secondary-button" style={{ minHeight: '50px' }} onClick={() => setCapturedImage(null)}>다시 촬영</button>
          <button className="primary-button" style={{ minHeight: '50px' }} onClick={sendImageToPC}><UploadCloud size={18} /> PC로 전송</button>
        </div>
      ) : (
        <button className="primary-button identity-full-button" style={{ minHeight: '60px', marginTop: '1rem' }} onClick={capture}><Camera size={20} /> 촬영하기</button>
      )}
    </div>
  );
}