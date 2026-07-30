import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CreditCard,
  Monitor,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { api, apiErrorMessage, candidateAuthHeaders } from '../api/client';
import { registerLiveStream } from '../applicant/liveMonitoring';

export default function ExamCheckPage() {
  const navigate = useNavigate();

  // 신분증 촬영용 영상
  const idVideoRef = useRef(null);
  const idCaptureModalVideoRef = useRef(null);

  // 화면 공유 영상
  const displayRef = useRef(null);

  // 영상 캡처용 canvas
  const canvasRef = useRef(null);

  // 스트림 보관
  const webcamStreamRef = useRef(null);
  const idWebcamStreamRef = useRef(null);
  const displayStreamRef = useRef(null);

  // 촬영 결과
  const [idCardImage, setIdCardImage] = useState('');
  // 점검 상태
  const [idCaptureModalOpen, setIdCaptureModalOpen] = useState(false);
  const [idWebcamReady, setIdWebcamReady] = useState(false);
  const [capturedIdImage, setCapturedIdImage] = useState('');


  const [webcamReady, setWebcamReady] = useState(false);
  const [displayReady, setDisplayReady] = useState(false);
  const [qrConnected, setQrConnected] = useState(false);

  // 동적 토큰 상태들
  const [idScanToken, setIdScanToken] = useState(''); // 신분증 스캔용 토큰
  const [auxCamToken, setAuxCamToken] = useState(''); // 보조 카메라용 토큰
  const [errorMsg, setErrorMsg] = useState('');
  const [examSession, setExamSession] = useState(null);

  const persistMediaStatus = useCallback(async (media, { silent = false } = {}) => {
    const token = localStorage.getItem('candidateAccessToken');
    if (!token || !examSession) return;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await api.put('/applicant/media-status', { media }, { headers: candidateAuthHeaders() });
        return;
      } catch (reason) {
        if (reason.response || attempt === 2) {
          if (silent) console.warn('장비 연결 상태 동기화 실패:', reason);
          else setErrorMsg(apiErrorMessage(reason, '감독관 화면에 장비 연결 상태를 저장하지 못했습니다.'));
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
  }, [examSession]);

  const syncMediaStatus = useCallback((patch, options) => persistMediaStatus({
    webcam: webcamReady,
    microphone: webcamReady,
    screen: displayReady,
    auxiliaryCamera: qrConnected,
    ...patch
  }, options), [displayReady, persistMediaStatus, qrConnected, webcamReady]);


  useEffect(() => {
    generateNewToken();
    api.get('/applicant/session', { headers: candidateAuthHeaders() })
      .then(({ data }) => setExamSession(data))
      .catch((reason) => setErrorMsg(apiErrorMessage(reason, '초대받은 시험 세션을 확인할 수 없습니다.')));

    return () => {
      // 모달용 웹캠 스트림 정리
      if (idWebcamStreamRef.current) {
        idWebcamStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!idScanToken) return undefined;
    // 🌟 모바일 페이지(MobileScanPage 등)에서 보낸 연동 완료 신호 수신 리스너
    const channel = new BroadcastChannel('exam_qr_channel'); // 채널 이름 통일
    channel.onmessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'ID_CARD_CAPTURED' && event.data.token === idScanToken) {
        setIdCardImage(event.data.image);
      }
    };
    return () => channel.close();
  }, [idScanToken]);

  useEffect(() => {
    if (!examSession) return;
    syncMediaStatus({}, { silent: true });
  }, [displayReady, examSession, qrConnected, syncMediaStatus, webcamReady]);

  useEffect(() => {
    if (!examSession) return undefined;
    const timer = window.setInterval(() => syncMediaStatus({}, { silent: true }), 10_000);
    return () => window.clearInterval(timer);
  }, [examSession, syncMediaStatus]);

  // 🌟 폰이 실제로 QR을 스캔해 보조 카메라를 연결하면 서버에 물어봐서 자동 감지
  useEffect(() => {
    if (!auxCamToken || qrConnected) return;
    const interval = setInterval(() => {
      api.get(`/applicant/auxiliary-devices/${auxCamToken}`, { headers: candidateAuthHeaders() })
        .then(({ data }) => {
          if (data.connected) {
            setQrConnected(true);
            syncMediaStatus({ auxiliaryCamera: true });
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [auxCamToken, qrConnected, syncMediaStatus]);

  // 토큰 생성 함수
  const generateNewToken = async () => {
    const generate = () => window.crypto.randomUUID ? window.crypto.randomUUID() : `${Math.random().toString(36).substring(2)}-${Date.now().toString(36)}`;
    setIdScanToken(generate());
    setAuxCamToken('');

    // 상태 초기화
    setIdCardImage('');
    setQrConnected(false);
    setErrorMsg('');
    try {
      const { data } = await api.post('/applicant/auxiliary-devices', {}, { headers: candidateAuthHeaders() });
      setAuxCamToken(data.token);
    } catch (error) {
      setErrorMsg(apiErrorMessage(error, '보조 카메라 QR 코드를 생성하지 못했습니다.'));
    }
  };

  /**
   * 웹캠과 마이크 연결
   */
  const startWebcam = async () => {
    try {
      webcamStreamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      webcamStreamRef.current = stream;
      registerLiveStream('webcam', stream);

      if (idVideoRef.current) {
        idVideoRef.current.srcObject = stream;
      }

      setWebcamReady(true);
      setErrorMsg('');
      syncMediaStatus({ webcam: true, microphone: stream.getAudioTracks().length > 0 });
    } catch (error) {
      console.error('웹캠 연결 오류:', error);
      setWebcamReady(false);
      setErrorMsg('웹캠 및 마이크 권한을 허용해야 합니다.');
    }
  };

  // 신분증 촬영 모달 열기 및 웹캠 시작
  const openIdCaptureModal = async () => {
    setCapturedIdImage('');
    setIdCaptureModalOpen(true);
    setIdWebcamReady(false);
    try {
      // 기존 스트림 정리
      if (idWebcamStreamRef.current) {
        idWebcamStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      idWebcamStreamRef.current = stream;
      if (idCaptureModalVideoRef.current) {
        idCaptureModalVideoRef.current.srcObject = stream;
      }
      setIdWebcamReady(true);
    } catch (err) {
      setErrorMsg('웹캠을 연결할 수 없습니다. 카메라 권한을 확인해주세요.');
      console.error("Error accessing webcam for ID capture:", err);
      closeIdCaptureModal();
    }
  };

  // 신분증 촬영 모달 닫기 및 웹캠 정지
  const closeIdCaptureModal = () => {
    if (idWebcamStreamRef.current) {
      idWebcamStreamRef.current.getTracks().forEach((track) => track.stop());
      idWebcamStreamRef.current = null;
    }
    setIdCaptureModalOpen(false);
    setIdWebcamReady(false);
    setCapturedIdImage('');
  };

  // 모달 안에서 신분증 촬영
  const handleCaptureInModal = () => {
    const image = captureVideoFrame(idCaptureModalVideoRef.current);
    if (image) {
      setCapturedIdImage(image);
    } else {
      setErrorMsg('카메라가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 촬영한 신분증 이미지 확정
  const confirmIdCardImage = () => {
    if (capturedIdImage) {
      setIdCardImage(capturedIdImage);
      closeIdCaptureModal();
    }
  };

  // 모달 안에서 재촬영
  const retakeIdCardInModal = () => {
    setCapturedIdImage('');
    if (idCaptureModalVideoRef.current) {
      idCaptureModalVideoRef.current.play().catch(console.error);
    }
  };

  /**
   * 비디오 화면 한 장을 이미지로 캡처
   */
  const captureVideoFrame = (videoElement) => {
    const canvas = canvasRef.current;
    if (!videoElement || !canvas) return null;
    if (videoElement.readyState < 2) return null;

    const width = videoElement.videoWidth || 1280;
    const height = videoElement.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.drawImage(videoElement, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.92);
  };

  /**
   * PC 화면 공유
   */
  const startDisplayShare = async () => {
    try {
      displayStreamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      displayStreamRef.current = stream;
      registerLiveStream('screen', stream);

      if (displayRef.current) {
        displayRef.current.srcObject = stream;
      }

      setDisplayReady(true);
      setErrorMsg('');
      syncMediaStatus({ screen: true });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setDisplayReady(false);
          syncMediaStatus({ screen: false });
        };
      }
    } catch (error) {
      console.error('화면 공유 오류:', error);
      setDisplayReady(false);
      setErrorMsg('전체 모니터 화면 공유를 허용해야 합니다.');
    }
  };

  const markAuxiliaryCameraForTest = () => {
    setQrConnected(true);
    syncMediaStatus({ auxiliaryCamera: true });
    setErrorMsg('');
  };

  const isAllReady =
    webcamReady &&
    Boolean(idCardImage) &&
    displayReady &&
    qrConnected;

  return (
    <div className="container">
      <h1 className="main-title" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
        시험 사전 환경 점검
      </h1>

      <p className="sub-description" style={{ marginBottom: '2rem' }}>
        공정하고 안정적인 테스트 응시를 위해 본인 인증, PC 장비 및 보조 카메라 연결 상태를 확인합니다.
      </p>
      {examSession && <div className="workspace-alert">응시 시험: {examSession.exam.title} · 응시번호: {examSession.candidate.candidateNumber}</div>}

      {errorMsg && (
        <div className="alert-box alert-error">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid">
        {/* 1. 신분증 촬영 */}
        <div className="card">
          <div className="card-header">
            <div className="check-card-title">
              <CreditCard size={20} color="#2563EB" />
              <h3>1. 신분증 촬영</h3>
            </div>
            {idCardImage && <CheckCircle2 color="#16a34a" />}
          </div>

          <div className="qr-connection-box">
            {idCardImage ? (
              <img src={idCardImage} alt="촬영한 신분증" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
            ) : (
              <>
                <QRCodeCanvas value={`${window.location.origin}/mobile/id-scan?token=${idScanToken}`} size={120} />
                <span style={{ marginTop: '10px' }}>휴대폰으로 QR코드를 스캔하여<br/>신분증을 촬영해주세요.</span>
              </>
            )}
          </div>

          <div className="identity-status-list">
            <div>
              <span>신분증 촬영</span>
              <strong className={idCardImage ? 'text-success' : 'text-danger'}>{idCardImage ? '완료' : '대기'}</strong>
            </div>
          </div>

          {idCardImage ? (
            <button type="button" className="btn-secondary identity-full-button" onClick={generateNewToken}>
              <RefreshCw size={18} /> 신분증 다시 촬영
            </button>
          ) : (
            <div className="identity-action-row" style={{ gridTemplateColumns: '1fr', marginTop: '0.75rem' }}>
              <button type="button" onClick={openIdCaptureModal} className="secondary-button compact-button" style={{ justifyContent: 'center', minHeight: '44px' }}>
                PC 카메라로 인증
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="check-card-title">
              <Monitor size={20} color="#2563EB" />
              <h3>2. PC 화면 공유</h3>
            </div>
            {displayReady && <CheckCircle2 color="#16a34a" />}
          </div>

          <div className="video-box">
            <video ref={displayRef} autoPlay playsInline muted className="video-stream" />
            {!displayReady && <span className="video-placeholder">화면 공유가 연결되지 않았습니다.</span>}
          </div>

          <button type="button" className="btn-primary identity-full-button" onClick={startDisplayShare}>
            <Monitor size={18} /> 화면 공유 권한 요청
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="check-card-title">
              <Camera size={20} color="#2563EB" />
              <h3>3. 웹캠·마이크 연결 확인</h3>
            </div>
            {webcamReady && <CheckCircle2 color="#16a34a" />}
          </div>

          <div className="video-box">
            <video ref={idVideoRef} autoPlay playsInline muted className="video-stream" />
            {!webcamReady && <span className="video-placeholder">웹캠과 마이크가 연결되지 않았습니다.</span>}
          </div>

          <div className="identity-status-list">
            <div><span>웹캠</span><strong className={webcamReady ? 'text-success' : 'text-danger'}>{webcamReady ? '연결됨' : '대기'}</strong></div>
            <div><span>마이크</span><strong className={webcamReady ? 'text-success' : 'text-danger'}>{webcamReady ? '연결됨' : '대기'}</strong></div>
          </div>
          <button type="button" className="btn-primary identity-full-button" onClick={startWebcam}>
            <Camera size={18} /> {webcamReady ? '웹캠/마이크 다시 연결' : '웹캠/마이크 연결하기'}
          </button>
        </div>

        {/* 4. 측면 보조 카메라 (🌟 /mobile/scan 경로 및 토큰 반영) */}
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <div className="check-card-title">
              <QrCode size={20} color="#2563EB" />
              <h3>4. 측면 보조 카메라</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                onClick={generateNewToken}
                title="QR 새로고침"
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <RefreshCw size={16} color="#64748b" />
              </button>
              {qrConnected && <CheckCircle2 color="#16a34a" />}
            </div>
          </div>

          <div className="qr-connection-box" style={{ flexDirection: 'column', gap: '8px' }}>
            {/* MobileScanPage로 바로 연결되는 QR 주소 생성 */}
            <QRCodeCanvas value={`${window.location.origin}/mobile/scan?token=${auxCamToken}`} size={120} />
            <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', wordBreak: 'break-all', padding: '0 5px' }}>
              토큰: {auxCamToken ? `${auxCamToken.slice(0, 8)}...` : '생성 중'}
            </span>
          </div>

          <div
            className="identity-full-button"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '46px',
              backgroundColor: qrConnected ? '#dcfce7' : '#f8fafc',
              color: qrConnected ? '#15803d' : '#64748b', border: `1px solid ${qrConnected ? '#86efac' : '#cbd5e1'}`,
            }}
          >
            {qrConnected ? '모바일 보조 카메라 연결 완료' : '휴대폰으로 QR을 스캔해 카메라를 연결해주세요.'}
          </div>
          <button
            type="button"
            className="btn-secondary identity-full-button"
            onClick={markAuxiliaryCameraForTest}
            disabled={qrConnected}
            style={{ marginTop: '10px' }}
          >
            {qrConnected ? '테스트 인증 완료' : '[임시] 보조 카메라 인증 완료'}
          </button>
        </div>
      </div>

      <div className="footer-box">
        <div className="status-summary">
          <span>
            신분증: <strong className={idCardImage ? 'text-success' : 'text-danger'}>{idCardImage ? '촬영 완료' : '미촬영'}</strong>
          </span>
          <span>
            웹캠/마이크: <strong className={webcamReady ? 'text-success' : 'text-danger'}>{webcamReady ? '연결됨' : '미연결'}</strong>
          </span>
          <span>
            화면 공유: <strong className={displayReady ? 'text-success' : 'text-danger'}>{displayReady ? '연결됨' : '미완료'}</strong>
          </span>
          <span>
            보조 카메라: <strong className={qrConnected ? 'text-success' : 'text-danger'}>{qrConnected ? '연결됨' : '대기 중'}</strong>
          </span>
        </div>

        <button type="button" className="btn-primary" disabled={!isAllReady || !examSession} onClick={() => navigate('/exam/session')}>
          {isAllReady ? '코딩 테스트 응시 시작' : '모든 점검 항목을 완료해주세요'}
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 신분증 촬영 모달 (Portal 사용) */}
      {idCaptureModalOpen && createPortal(
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>PC 카메라로 신분증 촬영</h3>
                <button onClick={closeIdCaptureModal} className="modal-close-btn">&times;</button>
              </div>
              <div className="modal-body">
                <div className="identity-camera-box">
                  <video ref={idCaptureModalVideoRef} autoPlay playsInline muted className="video-stream" />
                  {!idWebcamReady && <span className="video-placeholder">웹캠을 불러오는 중...</span>}

                  {/* 촬영 가이드 UI */}
                  {!capturedIdImage && idWebcamReady && (
                    <div className="id-card-guide">
                      <div className="id-card-guide-frame"></div>
                      <span>가이드 선 안에 신분증을 맞춰주세요</span>
                    </div>
                  )}

                  {/* 촬영 후 이미지 미리보기 */}
                  {capturedIdImage && <img src={capturedIdImage} alt="촬영된 신분증" className="captured-image-overlay" />}
                </div>
              </div>
              <div className="modal-footer">
                {capturedIdImage ? (
                  <>
                    <button onClick={retakeIdCardInModal} className="btn-secondary">다시 촬영</button>
                    <button onClick={confirmIdCardImage} className="btn-primary">이 사진 사용</button>
                  </>
                ) : (
                  <button onClick={handleCaptureInModal} className="btn-primary" disabled={!idWebcamReady}>촬영하기</button>
                )}
              </div>
            </div>
          </div>,
          document.body
      )}
    </div>
  );
}
