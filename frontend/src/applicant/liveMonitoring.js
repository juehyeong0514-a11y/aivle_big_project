import { api, candidateAuthHeaders } from '../api/client';

const liveState = window.__aivleLiveMonitoring ??= { streams: new Map(), livePeers: new Map(), answeringOffers: new Set() };
liveState.answeringOffers ??= new Set();
const { streams, livePeers, answeringOffers } = liveState;
let polling = false;
let snapshotTimer = null;
let offerPollTimer = null;
let offerPollInFlight = false;

const waitForIceComplete = (peer) => new Promise((resolve) => {
  if (peer.iceGatheringState === 'complete') return resolve();
  const finish = () => {
    window.clearTimeout(timeout);
    peer.removeEventListener('icegatheringstatechange', handleStateChange);
    resolve();
  };
  const handleStateChange = () => {
    if (peer.iceGatheringState === 'complete') {
      finish();
    }
  };
  const timeout = window.setTimeout(finish, 3000);
  peer.addEventListener('icegatheringstatechange', handleStateChange);
});

export const registerLiveStream = (kind, stream) => {
  streams.set(kind, stream);
  startOfferPolling();
  if (kind === 'webcam') {
    if (snapshotTimer) window.clearInterval(snapshotTimer);
    snapshotTimer = window.setInterval(() => uploadSnapshot(stream), 10000);
    uploadSnapshot(stream);
  }
};

export const hasActiveLiveStream = (kind) => streams.get(kind)?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;

export const stopLiveMonitoring = () => {
  if (snapshotTimer) window.clearInterval(snapshotTimer);
  if (offerPollTimer) window.clearInterval(offerPollTimer);
  snapshotTimer = null;
  offerPollTimer = null;
  polling = false;
  offerPollInFlight = false;
  answeringOffers.clear();
  livePeers.forEach((peer) => peer.close());
  livePeers.clear();
  streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
  streams.clear();
};

const uploadSnapshot = (stream) => {
  if (streams.get('webcam') !== stream || !stream.getVideoTracks().some((track) => track.readyState === 'live')) return;
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.play().then(() => window.setTimeout(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (streams.get('webcam') === stream && stream.getVideoTracks().some((track) => track.readyState === 'live')) {
      api.put('/applicant/monitoring-snapshot', { image: canvas.toDataURL('image/jpeg', .55) }, { headers: candidateAuthHeaders() }).catch(() => {});
    }
    video.srcObject = null;
  }, 250)).catch(() => {});
};

const startOfferPolling = () => {
  if (polling) return;
  polling = true;
  const pollOffers = async () => {
    if (streams.size === 0 || offerPollInFlight) return;
    offerPollInFlight = true;
    try {
      const { data } = await api.get('/applicant/live-offers', { headers: candidateAuthHeaders() });
      if (data?.offer && !answeringOffers.has(data.id)) {
        answeringOffers.add(data.id);
        void answerOffer(data)
          .catch((error) => console.warn('라이브 화면 연결 응답에 실패했습니다.', error))
          .finally(() => answeringOffers.delete(data.id));
      }
    } catch (error) {
      console.warn('라이브 화면 연결 요청을 확인하지 못했습니다.', error);
    } finally {
      offerPollInFlight = false;
    }
  };
  void pollOffers();
  offerPollTimer = window.setInterval(pollOffers, 1200);
};

const answerOffer = async ({ id, offer }) => {
  livePeers.get(id)?.close();
  const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  livePeers.set(id, peer);
  await peer.setRemoteDescription(offer);
  const webcamStream = streams.get('webcam');
  const screenStream = streams.get('screen');
  const webcamVideo = webcamStream?.getVideoTracks()[0];
  const screenVideo = screenStream?.getVideoTracks()[0];
  const microphone = webcamStream?.getAudioTracks()[0];
  if (webcamVideo) peer.addTrack(webcamVideo, webcamStream);
  if (screenVideo) peer.addTrack(screenVideo, screenStream);
  if (microphone) peer.addTrack(microphone, webcamStream);
  await peer.setLocalDescription(await peer.createAnswer());
  await waitForIceComplete(peer);
  await api.post('/applicant/live-offers/' + id + '/answer', { answer: peer.localDescription }, { headers: candidateAuthHeaders() });
};
