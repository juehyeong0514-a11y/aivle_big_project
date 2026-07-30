import { api } from '../api/client';

export const startMobileLiveMonitoring = (deviceToken, stream) => {
  let active = true;
  let activePeer = null;
  let answering = false;

  const uploadSnapshot = () => {
    if (!active || !stream.getVideoTracks().some((track) => track.readyState === 'live')) return;
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    void video.play().then(() => window.setTimeout(() => {
      if (!active) return;
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        void api.put('/mobile-devices/' + deviceToken + '/snapshot', { image: canvas.toDataURL('image/jpeg', .55) });
      }
      video.srcObject = null;
    }, 250)).catch(() => {});
  };

  const answerOffer = async ({ id, offer }) => {
    activePeer?.close();
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    activePeer = peer;
    await peer.setRemoteDescription(offer);
    const video = stream.getVideoTracks()[0];
    if (video) peer.addTrack(video, stream);
    await peer.setLocalDescription(await peer.createAnswer());
    await new Promise((resolve) => {
      if (peer.iceGatheringState === 'complete') return resolve();
      const timeout = window.setTimeout(resolve, 3000);
      peer.addEventListener('icegatheringstatechange', () => {
        if (peer.iceGatheringState === 'complete') {
          window.clearTimeout(timeout);
          resolve();
        }
      }, { once: true });
    });
    await api.post('/mobile-devices/' + deviceToken + '/live-offers/' + id + '/answer', { answer: peer.localDescription });
  };

  const offerTimer = window.setInterval(async () => {
    if (!active || answering) return;
    try {
      const { data } = await api.get('/mobile-devices/' + deviceToken + '/live-offers');
      if (!data?.offer) return;
      answering = true;
      await answerOffer(data);
    } catch (error) {
      console.warn('보조 카메라 라이브 연결에 실패했습니다.', error);
    } finally {
      answering = false;
    }
  }, 1200);
  const snapshotTimer = window.setInterval(uploadSnapshot, 10000);
  uploadSnapshot();

  return () => {
    active = false;
    window.clearInterval(offerTimer);
    window.clearInterval(snapshotTimer);
    activePeer?.close();
    void fetch(`${api.defaults.baseURL}/mobile-devices/${encodeURIComponent(deviceToken)}/disconnect`, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
    stream.getTracks().forEach((track) => track.stop());
  };
};
