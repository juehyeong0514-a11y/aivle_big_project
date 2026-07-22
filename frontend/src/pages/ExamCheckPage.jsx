import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CreditCard,
  Monitor,
  QrCode,
  ScanFace,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function ExamCheckPage() {
  const navigate = useNavigate();

  // 신분증 촬영용 영상
  const idVideoRef = useRef(null);

  // 얼굴 촬영용 영상
  const faceVideoRef = useRef(null);

  // 화면 공유 영상
  const displayRef = useRef(null);

  // 영상 캡처용 canvas
  const canvasRef = useRef(null);

  // 스트림 보관
  const webcamStreamRef = useRef(null);
  const displayStreamRef = useRef(null);

  // 촬영 결과
  const [idCardImage, setIdCardImage] = useState('');
  const [faceImage, setFaceImage] = useState('');

  // 점검 상태
  const [webcamReady, setWebcamReady] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [displayReady, setDisplayReady] = useState(false);
  const [qrConnected, setQrConnected] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return () => {
      webcamStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      displayStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
    };
  }, []);

  /**
   * 웹캠과 마이크 연결
   * 하나의 웹캠 스트림을 신분증 촬영 화면과 얼굴 촬영 화면에 동시에 표시
   */
  const startWebcam = async () => {
    try {
      webcamStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      webcamStreamRef.current = stream;

      if (idVideoRef.current) {
        idVideoRef.current.srcObject = stream;
      }

      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
      }

      setWebcamReady(true);
      setIdCardImage('');
      setFaceImage('');
      setIdentityReady(false);
      setErrorMsg('');
    } catch (error) {
      console.error('웹캠 연결 오류:', error);

      setWebcamReady(false);
      setIdentityReady(false);
      setErrorMsg(
        '웹캠 및 마이크 권한을 허용해야 합니다.',
      );
    }
  };

  /**
   * 비디오 화면 한 장을 이미지로 캡처
   */
  const captureVideoFrame = (videoElement) => {
    const canvas = canvasRef.current;

    if (!videoElement || !canvas) {
      return null;
    }

    if (videoElement.readyState < 2) {
      return null;
    }

    const width = videoElement.videoWidth || 1280;
    const height = videoElement.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.drawImage(
      videoElement,
      0,
      0,
      width,
      height,
    );

    return canvas.toDataURL('image/jpeg', 0.92);
  };

  /**
   * 신분증 웹캠 촬영
   */
  const captureIdCard = () => {
    if (!webcamReady) {
      setErrorMsg('웹캠과 마이크를 먼저 연결해주세요.');
      return;
    }

    const capturedImage = captureVideoFrame(
      idVideoRef.current,
    );

    if (!capturedImage) {
      setErrorMsg(
        '카메라 화면이 준비될 때까지 잠시 기다려주세요.',
      );
      return;
    }

    setIdCardImage(capturedImage);
    setIdentityReady(false);
    setErrorMsg('');
  };

  /**
   * 얼굴 웹캠 촬영
   */
  const captureFace = () => {
    if (!webcamReady) {
      setErrorMsg('웹캠과 마이크를 먼저 연결해주세요.');
      return;
    }

    const capturedImage = captureVideoFrame(
      faceVideoRef.current,
    );

    if (!capturedImage) {
      setErrorMsg(
        '카메라 화면이 준비될 때까지 잠시 기다려주세요.',
      );
      return;
    }

    setFaceImage(capturedImage);
    setIdentityReady(false);
    setErrorMsg('');
  };

  /**
   * 현재는 프론트 테스트용 임시 인증
   * 추후 백엔드의 OCR 및 얼굴 비교 API 호출로 교체
   */
  const verifyIdentity = () => {
    if (!idCardImage) {
      setErrorMsg('신분증을 먼저 촬영해주세요.');
      return;
    }

    if (!faceImage) {
      setErrorMsg('현재 얼굴을 먼저 촬영해주세요.');
      return;
    }

    setVerifying(true);
    setIdentityReady(false);
    setErrorMsg('');

    // 추후 Axios API 요청으로 교체
    window.setTimeout(() => {
      setVerifying(false);
      setIdentityReady(true);
    }, 1500);
  };

  /**
   * PC 화면 공유
   */
  const startDisplayShare = async () => {
    try {
      displayStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      const stream =
        await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

      displayStreamRef.current = stream;

      if (displayRef.current) {
        displayRef.current.srcObject = stream;
      }

      setDisplayReady(true);
      setErrorMsg('');

      const videoTrack = stream.getVideoTracks()[0];

      if (videoTrack) {
        videoTrack.onended = () => {
          setDisplayReady(false);
        };
      }
    } catch (error) {
      console.error('화면 공유 오류:', error);

      setDisplayReady(false);
      setErrorMsg(
        '전체 모니터 화면 공유를 허용해야 합니다.',
      );
    }
  };

  const toggleQrConnection = () => {
    setQrConnected((previous) => !previous);
    setErrorMsg('');
  };

  const isAllReady =
    webcamReady &&
    Boolean(idCardImage) &&
    Boolean(faceImage) &&
    identityReady &&
    displayReady &&
    qrConnected;

  return (
    <div className="container">
      <h1
        className="main-title"
        style={{
          fontSize: '1.75rem',
          marginBottom: '0.5rem',
        }}
      >
        시험 사전 환경 점검
      </h1>

      <p
        className="sub-description"
        style={{ marginBottom: '2rem' }}
      >
        공정하고 안정적인 테스트 응시를 위해 본인 인증,
        PC 장비 및 보조 카메라 연결 상태를 확인합니다.
      </p>

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

            {idCardImage && (
              <CheckCircle2 color="#16a34a" />
            )}
          </div>

          <div className="video-box identity-camera-box">
            <video
              ref={idVideoRef}
              autoPlay
              playsInline
              muted
              className="video-stream"
            />

            {!webcamReady && (
              <span className="video-placeholder">
                카메라가 연결되지 않았습니다.
              </span>
            )}

            {webcamReady && !idCardImage && (
              <div className="id-card-guide">
                <div className="id-card-guide-frame" />

                <span>
                  신분증을 가이드 안에 맞춰주세요.
                </span>
              </div>
            )}

            {idCardImage && (
              <img
                src={idCardImage}
                alt="촬영한 신분증"
                className="captured-image-overlay"
              />
            )}
          </div>

          <div className="identity-status-list">
            <div>
              <span>웹캠 연결</span>

              <strong
                className={
                  webcamReady
                    ? 'text-success'
                    : 'text-danger'
                }
              >
                {webcamReady ? '정상' : '대기'}
              </strong>
            </div>

            <div>
              <span>신분증 촬영</span>

              <strong
                className={
                  idCardImage
                    ? 'text-success'
                    : 'text-danger'
                }
              >
                {idCardImage ? '완료' : '대기'}
              </strong>
            </div>
          </div>

          {!webcamReady ? (
            <button
              type="button"
              className="btn-primary identity-full-button"
              onClick={startWebcam}
            >
              <Camera size={18} />
              웹캠/마이크 연결하기
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary identity-full-button"
              onClick={captureIdCard}
            >
              <Camera size={18} />

              {idCardImage
                ? '신분증 다시 촬영'
                : '신분증 촬영'}
            </button>
          )}
        </div>

        {/* 2. 얼굴 촬영 및 본인 인증 */}
        <div className="card">
          <div className="card-header">
            <div className="check-card-title">
              <ScanFace size={20} color="#2563EB" />

              <h3>2. 얼굴 인증</h3>
            </div>

            {identityReady && (
              <CheckCircle2 color="#16a34a" />
            )}
          </div>

          <div className="video-box">
            <video
              ref={faceVideoRef}
              autoPlay
              playsInline
              muted
              className="video-stream"
            />

            {!webcamReady && (
              <span className="video-placeholder">
                웹캠과 마이크가 연결되지 않았습니다.
              </span>
            )}

            {faceImage && (
              <img
                src={faceImage}
                alt="촬영한 현재 얼굴"
                className="face-capture-thumbnail"
              />
            )}
          </div>

          <div className="identity-status-list">
            <div>
              <span>현재 얼굴 촬영</span>

              <strong
                className={
                  faceImage
                    ? 'text-success'
                    : 'text-danger'
                }
              >
                {faceImage ? '완료' : '대기'}
              </strong>
            </div>

            <div>
              <span>신분증 얼굴 비교</span>

              <strong
                className={
                  identityReady
                    ? 'text-success'
                    : 'text-danger'
                }
              >
                {verifying
                  ? '확인 중'
                  : identityReady
                    ? '인증 완료'
                    : '대기'}
              </strong>
            </div>
          </div>

          {!webcamReady ? (
            <button
              type="button"
              className="btn-primary identity-full-button"
              onClick={startWebcam}
            >
              <Camera size={18} />
              웹캠/마이크 연결하기
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary identity-full-button"
                onClick={captureFace}
              >
                <Camera size={18} />

                {faceImage
                  ? '현재 얼굴 다시 촬영'
                  : '현재 얼굴 촬영'}
              </button>

              <button
                type="button"
                className="btn-primary identity-full-button"
                disabled={
                  verifying ||
                  !idCardImage ||
                  !faceImage
                }
                onClick={verifyIdentity}
              >
                {verifying
                  ? '신분증과 얼굴 비교 중...'
                  : identityReady
                    ? '본인 인증 완료'
                    : '본인 인증 시작'}
              </button>
            </>
          )}
        </div>

        {/* 3. PC 화면 공유 */}
        <div className="card">
          <div className="card-header">
            <div className="check-card-title">
              <Monitor size={20} color="#2563EB" />

              <h3>3. PC 화면 공유</h3>
            </div>

            {displayReady && (
              <CheckCircle2 color="#16a34a" />
            )}
          </div>

          <div className="video-box">
            <video
              ref={displayRef}
              autoPlay
              playsInline
              muted
              className="video-stream"
            />

            {!displayReady && (
              <span className="video-placeholder">
                화면 공유가 연결되지 않았습니다.
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn-primary identity-full-button"
            onClick={startDisplayShare}
          >
            <Monitor size={18} />
            화면 공유 권한 요청
          </button>
        </div>

        {/* 4. 측면 보조 카메라 */}
        <div className="card">
          <div className="card-header">
            <div className="check-card-title">
              <QrCode size={20} color="#2563EB" />

              <h3>4. 측면 보조 카메라</h3>
            </div>

            {qrConnected && (
              <CheckCircle2 color="#16a34a" />
            )}
          </div>

          <div className="qr-connection-box">
            <QRCodeCanvas
              value="https://example.com/session-connect"
              size={130}
            />

            <span>
              휴대폰 카메라로 QR을 스캔하여
              <br />
              측면 각도에 비치해 주세요.
            </span>
          </div>

          <button
            type="button"
            className="btn-primary identity-full-button"
            style={{
              backgroundColor: qrConnected
                ? '#16a34a'
                : '#475569',
            }}
            onClick={toggleQrConnection}
          >
            {qrConnected
              ? '모바일 연동 완료됨 (클릭 시 해제)'
              : '[테스트용] 모바일 연동 완료 처리'}
          </button>
        </div>
      </div>

      <div className="footer-box">
        <div className="status-summary">
          <span>
            신분증:{' '}
            <strong
              className={
                idCardImage
                  ? 'text-success'
                  : 'text-danger'
              }
            >
              {idCardImage ? '촬영 완료' : '미촬영'}
            </strong>
          </span>

          <span>
            얼굴 인증:{' '}
            <strong
              className={
                identityReady
                  ? 'text-success'
                  : 'text-danger'
              }
            >
              {identityReady ? '완료' : '미완료'}
            </strong>
          </span>

          <span>
            화면 공유:{' '}
            <strong
              className={
                displayReady
                  ? 'text-success'
                  : 'text-danger'
              }
            >
              {displayReady ? '연결됨' : '미완료'}
            </strong>
          </span>

          <span>
            보조 카메라:{' '}
            <strong
              className={
                qrConnected
                  ? 'text-success'
                  : 'text-danger'
              }
            >
              {qrConnected ? '연결됨' : '대기 중'}
            </strong>
          </span>
        </div>

        <button
          type="button"
          className="btn-primary"
          disabled={!isAllReady}
          onClick={() => navigate('/exam/session')}
        >
          {isAllReady
            ? '코딩 테스트 응시 시작'
            : '모든 점검 항목을 완료해주세요'}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
}