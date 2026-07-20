import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Monitor, CheckCircle2, AlertCircle, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function ExamCheckPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const displayRef = useRef(null);

  const [webcamReady, setWebcamReady] = useState(false);
  const [displayReady, setDisplayReady] = useState(false);
  const [qrConnected, setQrConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setWebcamReady(true);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg('웹캠 및 마이크 권한을 허용해야 합니다.');
      setWebcamReady(false);
    }
  };

  const startDisplayShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (displayRef.current) displayRef.current.srcObject = stream;
      setDisplayReady(true);
      stream.getVideoTracks()[0].onended = () => setDisplayReady(false);
    } catch (err) {
      setErrorMsg('전체 모니터 화면 공유를 허용해야 합니다.');
      setDisplayReady(false);
    }
  };

  const isAllReady = webcamReady && displayReady && qrConnected;

  return (
    <div className="container">
      <h1 className="main-title" style={{fontSize: '1.75rem', marginBottom: '0.5rem'}}>시험 사전 환경 점검</h1>
      <p className="sub-description" style={{marginBottom: '2rem'}}>
        공정하고 안정적인 테스트 응시를 위해 PC 장비와 보조 카메라 연결을 확인합니다.
      </p>

      {errorMsg && (
        <div className="alert-box alert-error">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid">
        {/* 1번 카드: 웹캠 */}
        <div className="card">
          <div className="card-header">
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
              <Camera size={20} color="#2563EB" />
              <h3 style={{margin:0, fontSize:'1.1rem'}}>1. 정면 웹캠 및 마이크</h3>
            </div>
            {webcamReady && <CheckCircle2 color="#16a34a" />}
          </div>
          <div className="video-box">
            <video ref={videoRef} autoPlay playsInline muted className="video-stream" />
            {!webcamReady && <span className="video-placeholder">카메라가 연결되지 않았습니다.</span>}
          </div>
          <button className="btn-primary" style={{width:'100%', marginTop:'auto'}} onClick={startWebcam}>웹캠/마이크 연결하기</button>
        </div>

        {/* 2번 카드: 화면 공유 */}
        <div className="card">
          <div className="card-header">
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
              <Monitor size={20} color="#2563EB" />
              <h3 style={{margin:0, fontSize:'1.1rem'}}>2. PC 화면 공유</h3>
            </div>
            {displayReady && <CheckCircle2 color="#16a34a" />}
          </div>
          <div className="video-box">
            <video ref={displayRef} autoPlay playsInline muted className="video-stream" />
            {!displayReady && <span className="video-placeholder">화면 공유가 연결되지 않았습니다.</span>}
          </div>
          <button className="btn-primary" style={{width:'100%', marginTop:'auto'}} onClick={startDisplayShare}>화면 공유 권한 요청</button>
        </div>

        {/* 3번 카드: QR 연동 */}
        <div className="card">
          <div className="card-header">
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
              <QrCode size={20} color="#2563EB" />
              <h3 style={{margin:0, fontSize:'1.1rem'}}>3. 측면 보조 카메라</h3>
            </div>
            {qrConnected && <CheckCircle2 color="#16a34a" />}
          </div>
          <div className="video-box" style={{flexDirection: 'column', gap: '10px'}}>
            <QRCodeCanvas value="https://example.com/session-connect" size={130} />
            <span style={{fontSize: '0.8rem', color: '#64748b', textAlign: 'center'}}>
              휴대폰 카메라로 QR을 스캔하여<br/>측면 각도에 비치해 주세요.
            </span>
          </div>
          <button
            className={`btn-primary ${qrConnected ? 'bg-success' : 'bg-slate'}`}
            style={{width:'100%', marginTop:'auto', backgroundColor: qrConnected ? '#16a34a' : '#475569'}}
            onClick={() => setQrConnected(!qrConnected)}
          >
            {qrConnected ? '모바일 연동 완료됨 (클릭시 해제)' : '[테스트용] 모바일 연동 완료 처리'}
          </button>
        </div>
      </div>

      {/* 하단 시작 컨트롤 바 */}
      <div className="footer-box">
        <div className="status-summary">
          <span>본인 인증: <strong>완료(임시)</strong></span>
          <span>필수 장비: <strong className={webcamReady && displayReady ? 'text-success' : 'text-danger'}>{webcamReady && displayReady ? '정상' : '미완료'}</strong></span>
          <span>보조 카메라: <strong className={qrConnected ? 'text-success' : 'text-danger'}>{qrConnected ? '연결됨' : '대기중'}</strong></span>
        </div>

        <button
          className="btn-primary"
          disabled={!isAllReady}
          onClick={() => navigate('/exam/session')}
        >
          {isAllReady ? '코딩 테스트 응시 시작' : '모든 점검 항목을 완료해주세요'}
        </button>
      </div>
    </div>
  );
}