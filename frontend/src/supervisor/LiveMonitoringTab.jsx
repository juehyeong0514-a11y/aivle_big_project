import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, Clock3, Monitor, PanelLeftClose, PanelLeftOpen, Radio, Search, Video, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';
import { createMonitoringRefreshGate } from './monitoringRefreshGate.mjs';
import { normalizeAiMonitoring, warningSourceLabel } from './aiMonitoring.mjs';

const monitoringRefreshIntervalMs = 2000;

export default function LiveMonitoringTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examinees, setExaminees] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidateSort, setCandidateSort] = useState('attention');
  const [isAlertFeedCollapsed, setIsAlertFeedCollapsed] = useState(false);
  const [selectedExamineeId, setSelectedExamineeId] = useState('');
  const [lastSnapshotAt, setLastSnapshotAt] = useState(null);
  const [liveExaminee, setLiveExaminee] = useState(null);
  const [warningLogExaminee, setWarningLogExaminee] = useState(null);
  const [liveError, setLiveError] = useState('');
  const [frontLiveReady, setFrontLiveReady] = useState(false);
  const [auxiliaryLiveReady, setAuxiliaryLiveReady] = useState(false);
  const [screenLiveReady, setScreenLiveReady] = useState(false);
  const [microphoneLiveReady, setMicrophoneLiveReady] = useState(false);
  const [microphoneLiveEnabled, setMicrophoneLiveEnabled] = useState(false);
  const [microphoneLiveLevel, setMicrophoneLiveLevel] = useState(0);
  const [microphoneLiveSpeaking, setMicrophoneLiveSpeaking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const frontLiveRef = useRef(null);
  const auxiliaryLiveRef = useRef(null);
  const screenLiveRef = useRef(null);
  const microphoneLiveRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const microphoneAudioContextRef = useRef(null);
  const microphoneAnalyserRef = useRef(null);
  const microphoneMeterTimerRef = useRef(null);
  const livePeerRef = useRef(null);
  const auxiliaryPeerRef = useRef(null);
  const livePollTimerRef = useRef(null);
  const auxiliaryPollTimerRef = useRef(null);
  const liveRequestIdRef = useRef(0);
  const monitoringRefreshGateRef = useRef(createMonitoringRefreshGate());

  const applyMonitoringSnapshot = (snapshot) => {
    setExaminees(snapshot.examinees);
    setWarnings(snapshot.warnings);
    setLastSnapshotAt(snapshot.capturedAt);
  };

  const deferMonitoringRefresh = () => {
    monitoringRefreshGateRef.current.suspend();
  };

  const applyDeferredMonitoringRefresh = () => {
    const pendingSnapshot = monitoringRefreshGateRef.current.resume();
    if (pendingSnapshot) applyMonitoringSnapshot(pendingSnapshot);
  };

  const changeOrganization = (organizationId) => {
    monitoringRefreshGateRef.current.discard();
    setCandidateQuery('');
    setSelectedExamineeId('');
    setLoadError('');
    setOrganizationId(organizationId);
  };

  const changeExam = (examId) => {
    monitoringRefreshGateRef.current.discard();
    setCandidateQuery('');
    setSelectedExamineeId('');
    setLoadError('');
    setSelectedExamId(examId);
  };

  const deferMonitoringRefreshOnKey = (event) => {
    if ([' ', 'ArrowDown', 'Enter'].includes(event.key)) deferMonitoringRefresh();
  };

  useEffect(() => {
    api.get('/manager/organizations', { headers: authHeaders() })
      .then(({ data }) => {
        const managedOrganizations = data.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
        setOrganizations(managedOrganizations);
        setLoadError('');
        setOrganizationId((current) => managedOrganizations.some((organization) => organization.id === current)
          ? current
          : managedOrganizations[0]?.id || '');
      })
      .catch((error) => setLoadError(apiErrorMessage(error, '관제할 조직 목록을 불러오지 못했습니다.')));
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setExams([]);
      setSelectedExamId('');
      setCandidateQuery('');
      setSelectedExamineeId('');
      return;
    }
    api.get('/supervisor/exams?organizationId=' + encodeURIComponent(organizationId), { headers: authHeaders() })
      .then(({ data }) => {
        setExams(data);
        setSelectedExamId(data[0]?.id || '');
        setCandidateQuery('');
        setSelectedExamineeId('');
        setLoadError('');
      })
      .catch((error) => setLoadError(apiErrorMessage(error, '조직의 시험 목록을 불러오지 못했습니다.')));
  }, [organizationId]);

  useEffect(() => {
    if (!selectedExamId) {
      setExaminees([]);
      setWarnings([]);
      setLastSnapshotAt(null);
      setLiveExaminee(null);
      setWarningLogExaminee(null);
      return undefined;
    }
    let isCurrentSelection = true;
    const loadMonitoringData = () => Promise.all([
      api.get('/supervisor/examinees?organizationId=' + encodeURIComponent(organizationId) + '&examId=' + encodeURIComponent(selectedExamId), { headers: authHeaders() }),
      api.get('/supervisor/warnings?organizationId=' + encodeURIComponent(organizationId) + '&examId=' + encodeURIComponent(selectedExamId), { headers: authHeaders() })
    ])
      .then(([examineeResponse, warningResponse]) => {
        if (!isCurrentSelection) return;
        const snapshot = monitoringRefreshGateRef.current.receive({
          examinees: examineeResponse.data,
          warnings: warningResponse.data,
          capturedAt: new Date()
        });
        if (snapshot) {
          setLoadError('');
          applyMonitoringSnapshot(snapshot);
        }
      })
      .catch((error) => {
        if (isCurrentSelection) setLoadError(apiErrorMessage(error, '선택한 시험의 응시자 데이터를 불러오지 못했습니다.'));
      });
    loadMonitoringData();
    const timer = window.setInterval(loadMonitoringData, monitoringRefreshIntervalMs);
    return () => {
      isCurrentSelection = false;
      window.clearInterval(timer);
    };
  }, [organizationId, selectedExamId]);

  const sendWarning = async (examinee) => {
    const message = window.prompt('[' + examinee.name + '] 응시자에게 보낼 경고 메시지를 입력하세요.');
    if (!message) return;
    try {
      const { data } = await api.post('/supervisor/examinees/' + examinee.id + '/warnings', { examId: selectedExamId, message }, { headers: authHeaders() });
      setWarnings((current) => [{
        id: 'pending-' + Date.now(),
        examineeId: examinee.id,
        examineeName: examinee.name,
        message: message.trim(),
        source: 'SUPERVISOR',
        createdAt: new Date().toISOString()
      }, ...current]);
      window.alert('[전송 완료] ' + examinee.name + '님에게 ' + data.message);
    } catch (error) {
      window.alert(apiErrorMessage(error, '경고를 전송하지 못했습니다.'));
    }
  };

  const selectedExam = exams.find((exam) => exam.id === selectedExamId);
  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);
  const snapshotTime = lastSnapshotAt?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '갱신 대기';
  const warningsFor = (examineeId) => warnings
    .filter((warning) => warning.examineeId === examineeId)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  const orderedWarnings = warnings.slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  const normalizedCandidateQuery = candidateQuery.trim().toLowerCase();
  const warningExamineeName = (warning) => warning.examineeName || examinees.find((examinee) => examinee.id === warning.examineeId)?.name || '응시자';
  const visibleWarnings = orderedWarnings.filter((warning) => !normalizedCandidateQuery || warningExamineeName(warning).toLowerCase().includes(normalizedCandidateQuery));
  const visibleExaminees = examinees
    .filter((examinee) => !normalizedCandidateQuery || String(examinee.name ?? '').toLowerCase().includes(normalizedCandidateQuery))
    .sort((first, second) => {
      if (candidateSort === 'name') return String(first.name ?? '').localeCompare(String(second.name ?? ''), 'ko');
      if (candidateSort === 'warnings') return warningsFor(second.id).length - warningsFor(first.id).length
        || String(first.name ?? '').localeCompare(String(second.name ?? ''), 'ko');
      const statusPriority = { DANGER: 0, WARNING: 1, NORMAL: 2 };
      return (statusPriority[first.status] ?? 3) - (statusPriority[second.status] ?? 3)
        || warningsFor(second.id).length - warningsFor(first.id).length
        || String(first.name ?? '').localeCompare(String(second.name ?? ''), 'ko');
    });
  const currentLiveExaminee = liveExaminee ? examinees.find((examinee) => examinee.id === liveExaminee.id) ?? liveExaminee : null;
  const currentLiveAiMonitoring = normalizeAiMonitoring(currentLiveExaminee?.monitoringSnapshot);
  const currentLiveWarnings = currentLiveExaminee ? warningsFor(currentLiveExaminee.id) : [];

  useEffect(() => {
    const audio = microphoneLiveRef.current;
    if (!audio || !microphoneStreamRef.current) return;
    audio.srcObject = microphoneStreamRef.current;
    audio.muted = !microphoneLiveEnabled;
    void audio.play().catch(() => {});
  }, [liveExaminee, microphoneLiveReady, microphoneLiveEnabled]);

  const stopMicrophoneMeter = () => {
    if (microphoneMeterTimerRef.current) window.clearInterval(microphoneMeterTimerRef.current);
    microphoneMeterTimerRef.current = null;
    microphoneAnalyserRef.current?.disconnect();
    microphoneAudioContextRef.current?.close().catch(() => {});
    microphoneAnalyserRef.current = null;
    microphoneAudioContextRef.current = null;
    setMicrophoneLiveLevel(0);
    setMicrophoneLiveSpeaking(false);
  };

  const startMicrophoneMeter = (stream) => {
    stopMicrophoneMeter();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !stream) return;
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      microphoneAudioContextRef.current = audioContext;
      microphoneAnalyserRef.current = analyser;
      microphoneMeterTimerRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, sample) => {
          const normalized = (sample - 128) / 128;
          return sum + normalized * normalized;
        }, 0) / samples.length);
        const level = Math.min(1, rms * 5);
        setMicrophoneLiveLevel(level);
        setMicrophoneLiveSpeaking(level >= 0.08);
      }, 100);
    } catch {
      stopMicrophoneMeter();
    }
  };

  const closeWarningLog = () => setWarningLogExaminee(null);

  const closeLive = () => {
    liveRequestIdRef.current += 1;
    if (livePollTimerRef.current) window.clearInterval(livePollTimerRef.current);
    if (auxiliaryPollTimerRef.current) window.clearInterval(auxiliaryPollTimerRef.current);
    livePollTimerRef.current = null;
    auxiliaryPollTimerRef.current = null;
    livePeerRef.current?.close();
    auxiliaryPeerRef.current?.close();
    livePeerRef.current = null;
    auxiliaryPeerRef.current = null;
    if (frontLiveRef.current) frontLiveRef.current.srcObject = null;
    if (auxiliaryLiveRef.current) auxiliaryLiveRef.current.srcObject = null;
    if (screenLiveRef.current) screenLiveRef.current.srcObject = null;
    if (microphoneLiveRef.current) {
      microphoneLiveRef.current.srcObject = null;
      microphoneLiveRef.current.muted = true;
    }
    microphoneStreamRef.current = null;
    stopMicrophoneMeter();
    setLiveExaminee(null);
    setLiveError('');
    setFrontLiveReady(false);
    setAuxiliaryLiveReady(false);
    setScreenLiveReady(false);
    setMicrophoneLiveReady(false);
    setMicrophoneLiveEnabled(false);
  };

  const toggleMicrophoneLive = async () => {
    const audio = microphoneLiveRef.current;
    if (!audio || !microphoneLiveReady) return;
    if (microphoneLiveEnabled) {
      audio.muted = true;
      stopMicrophoneMeter();
      setMicrophoneLiveEnabled(false);
      return;
    }
    try {
      if (!microphoneMeterTimerRef.current && microphoneStreamRef.current) startMicrophoneMeter(microphoneStreamRef.current);
      await microphoneAudioContextRef.current?.resume();
      audio.muted = false;
      await audio.play();
      setMicrophoneLiveEnabled(true);
    } catch {
      audio.muted = true;
      setLiveError('마이크 소리를 재생하지 못했습니다.');
    }
  };

  const startAuxiliaryLive = async (examinee, requestId) => {
    try {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      auxiliaryPeerRef.current = peer;
      peer.addTransceiver('video', { direction: 'recvonly' });
      peer.onconnectionstatechange = () => {
        if (auxiliaryPeerRef.current !== peer || !['closed', 'disconnected', 'failed'].includes(peer.connectionState)) return;
        if (auxiliaryLiveRef.current) auxiliaryLiveRef.current.srcObject = null;
        setAuxiliaryLiveReady(false);
      };
      peer.ontrack = (event) => {
        if (event.track.kind !== 'video' || !auxiliaryLiveRef.current) return;
        auxiliaryLiveRef.current.srcObject = new MediaStream([event.track]);
        void auxiliaryLiveRef.current.play().then(() => setAuxiliaryLiveReady(true));
        event.track.onended = () => {
          if (auxiliaryPeerRef.current === peer) setAuxiliaryLiveReady(false);
        };
      };
      await peer.setLocalDescription(await peer.createOffer({ offerToReceiveVideo: true }));
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
      if (liveRequestIdRef.current !== requestId) {
        peer.close();
        return;
      }
      const { data } = await api.post('/supervisor/examinees/' + examinee.id + '/auxiliary-live-offers', { offer: peer.localDescription }, { headers: authHeaders() });
      if (liveRequestIdRef.current !== requestId) {
        peer.close();
        return;
      }
      const timer = window.setInterval(async () => {
        if (liveRequestIdRef.current !== requestId) return window.clearInterval(timer);
        try {
          const response = await api.get('/supervisor/live-offers/' + data.id, { headers: authHeaders() });
          if (response.data.answer) {
            window.clearInterval(timer);
            auxiliaryPollTimerRef.current = null;
            await peer.setRemoteDescription(response.data.answer);
          }
        } catch {
          window.clearInterval(timer);
          auxiliaryPollTimerRef.current = null;
        }
      }, 1200);
      auxiliaryPollTimerRef.current = timer;
    } catch {
      setAuxiliaryLiveReady(false);
    }
  };

  const openLive = async (examinee) => {
    closeLive();
    const requestId = liveRequestIdRef.current;
    setLiveExaminee(examinee);
    void startAuxiliaryLive(examinee, requestId);
    try {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      livePeerRef.current = peer;
      peer.onconnectionstatechange = () => {
        if (livePeerRef.current !== peer || !['closed', 'disconnected', 'failed'].includes(peer.connectionState)) return;
        if (frontLiveRef.current) frontLiveRef.current.srcObject = null;
        if (screenLiveRef.current) screenLiveRef.current.srcObject = null;
        if (microphoneLiveRef.current) microphoneLiveRef.current.srcObject = null;
        microphoneStreamRef.current = null;
        stopMicrophoneMeter();
        setFrontLiveReady(false);
        setScreenLiveReady(false);
        setMicrophoneLiveReady(false);
        setMicrophoneLiveEnabled(false);
        setLiveError('응시자 영상 연결이 종료되었습니다.');
      };
      peer.addTransceiver('video', { direction: 'recvonly' });
      const screenVideoTransceiver = peer.addTransceiver('video', { direction: 'recvonly' });
      peer.addTransceiver('audio', { direction: 'recvonly' });
      peer.ontrack = (event) => {
        if (event.track.kind === 'audio') {
          const microphoneStream = new MediaStream([event.track]);
          microphoneStreamRef.current = microphoneStream;
          startMicrophoneMeter(microphoneStream);
          if (microphoneLiveRef.current) {
            microphoneLiveRef.current.srcObject = microphoneStream;
            microphoneLiveRef.current.muted = true;
          }
          setMicrophoneLiveReady(true);
          event.track.onended = () => {
            if (livePeerRef.current !== peer) return;
            if (microphoneLiveRef.current) microphoneLiveRef.current.srcObject = null;
            microphoneStreamRef.current = null;
            stopMicrophoneMeter();
            setMicrophoneLiveReady(false);
            setMicrophoneLiveEnabled(false);
          };
          return;
        }
        if (event.track.kind !== 'video') return;
        const isScreen = event.transceiver === screenVideoTransceiver;
        const target = isScreen ? screenLiveRef.current : frontLiveRef.current;
        if (target) {
          target.srcObject = new MediaStream([event.track]);
          void target.play().then(() => {
            if (isScreen) setScreenLiveReady(true);
            else setFrontLiveReady(true);
            setLiveError('');
          }).catch(() => setLiveError('응시자 영상을 재생하지 못했습니다.'));
        }
        event.track.onended = () => {
          if (livePeerRef.current !== peer) return;
          if (isScreen) setScreenLiveReady(false);
          else setFrontLiveReady(false);
          setLiveError('응시자 영상 연결이 종료되었습니다.');
        };
      };
      await peer.setLocalDescription(await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }));
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
      if (liveRequestIdRef.current !== requestId) {
        peer.close();
        return;
      }
      const { data } = await api.post('/supervisor/examinees/' + examinee.id + '/live-offers', { offer: peer.localDescription }, { headers: authHeaders() });
      if (liveRequestIdRef.current !== requestId) {
        peer.close();
        return;
      }
      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        if (liveRequestIdRef.current !== requestId) return window.clearInterval(timer);
        try {
          const response = await api.get('/supervisor/live-offers/' + data.id, { headers: authHeaders() });
          if (response.data.answer) {
            window.clearInterval(timer);
            livePollTimerRef.current = null;
            await peer.setRemoteDescription(response.data.answer);
          } else if (Date.now() - startedAt > 30000) {
            window.clearInterval(timer);
            livePollTimerRef.current = null;
            setLiveError('응시자 영상 연결 요청이 만료되었습니다.');
          }
        } catch {
          window.clearInterval(timer);
          livePollTimerRef.current = null;
          setLiveError('응시자 라이브 연결에 실패했습니다.');
        }
      }, 1200);
      livePollTimerRef.current = timer;
    } catch {
      setLiveError('라이브 연결을 시작하지 못했습니다.');
    }
  };

  return (
    <section className="workspace-shell monitoring-page">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">LIVE MONITORING</span>
          <h1>실시간 모니터링</h1>
          <p>현재 작업 조직의 시험만 조회하고 응시자 상태를 실시간으로 확인합니다.</p>
        </div>
        <div className="workspace-role-mark manager"><Monitor size={20} /> 시험 감독 관리자</div>
      </div>

      {loadError && <div className="workspace-alert error">{loadError}</div>}
      <div className="data-panel monitoring-scope-panel" aria-label="관제 대상 선택">
        <div className="monitoring-scope-title"><span className="workspace-eyebrow">관제 대상</span><strong>조직과 시험 선택</strong></div>
        <label><span>조직</span>
          <select value={organizationId} onFocus={deferMonitoringRefresh} onPointerDown={deferMonitoringRefresh} onKeyDown={deferMonitoringRefreshOnKey} onBlur={applyDeferredMonitoringRefresh} onChange={(event) => changeOrganization(event.target.value)}>
            <option value="">조직을 선택하세요</option>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>
        <label><span>시험</span>
          <select value={selectedExamId} onFocus={deferMonitoringRefresh} onPointerDown={deferMonitoringRefresh} onKeyDown={deferMonitoringRefreshOnKey} onBlur={applyDeferredMonitoringRefresh} onChange={(event) => changeExam(event.target.value)} disabled={!organizationId}>
            <option value="">시험을 선택하세요</option>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
          </select>
        </label>
        <span className="monitoring-scope-summary"><Building2 size={15} /> {selectedExam ? `${selectedOrganization?.name} · ${selectedExam.examineeCount}명 관제 중` : selectedOrganization ? '시험을 선택하세요.' : '조직과 시험을 선택하세요.'}</span>
      </div>

      <div className={'monitoring-layout ' + (isAlertFeedCollapsed ? 'alert-feed-collapsed' : '')}>
      {selectedExamId && <aside className={'data-panel monitoring-alert-feed ' + (isAlertFeedCollapsed ? 'collapsed' : '')} aria-labelledby="monitoring-alert-feed-title">
        <div className="monitoring-alert-feed-heading">
          <button className="monitoring-alert-feed-tab" type="button" onClick={() => setIsAlertFeedCollapsed((collapsed) => !collapsed)} aria-expanded={!isAlertFeedCollapsed} aria-label={isAlertFeedCollapsed ? '실시간 감시 로그 펼치기' : '실시간 감시 로그 최소화'} title={isAlertFeedCollapsed ? '감시 로그 펼치기' : '감시 로그 접기'}>
            {isAlertFeedCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div>
            <span className="workspace-eyebrow"><AlertTriangle size={14} /> AI MONITORING FEED</span>
            <h2 id="monitoring-alert-feed-title">실시간 감시 로그</h2>
            <p>새로운 알림이 위에 표시되며, 모든 기록은 최신 시간순으로 정렬됩니다.</p>
          </div>
          <span className="monitoring-alert-feed-count">{visibleWarnings.length}건</span>
        </div>
        <div className="monitoring-alert-feed-content" hidden={isAlertFeedCollapsed}>
        <label className="monitoring-alert-search"><Search size={15} /><span className="sr-only">응시자 이름 검색</span><input value={candidateQuery} onChange={(event) => {
          setCandidateQuery(event.target.value);
          setSelectedExamineeId('');
        }} placeholder="응시자 이름 검색" />{candidateQuery && <button type="button" className="monitoring-alert-search-clear" onClick={() => {
          setCandidateQuery('');
          setSelectedExamineeId('');
        }} aria-label="응시자 이름 검색 지우기"><X size={15} /></button>}</label>
        {visibleWarnings.length ? <ol className="monitoring-alert-feed-list">{visibleWarnings.map((warning) => <li key={warning.id}>
          <button type="button" onClick={() => {
            setCandidateQuery(warningExamineeName(warning));
            setSelectedExamineeId(warning.examineeId);
          }}>
            <time dateTime={warning.createdAt}>{new Date(warning.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
            <strong>{warningExamineeName(warning)} <span className={'monitoring-source-badge source-' + String(warning.source ?? 'UNKNOWN').toLowerCase()}>{warningSourceLabel(warning.source)}</span></strong>
            <span>{warning.message}</span>
          </button>
        </li>)}</ol> : <p className="empty-state monitoring-alert-feed-empty">{candidateQuery ? '검색된 응시자 알림이 없습니다.' : '현재 기록된 감시 로그가 없습니다.'}</p>}
        </div>
      </aside>}

      {!organizationId && <div className="data-panel empty-state">관제할 조직을 선택해주세요.</div>}
      {organizationId && !exams.length && <div className="data-panel empty-state">선택한 조직에 등록된 시험이 없습니다.</div>}
      {selectedExamId && !examinees.length && <div className="data-panel empty-state">현재 선택한 시험에서 관제 중인 응시자가 없습니다.</div>}
      {liveExaminee && <div className="monitoring-live-modal" role="dialog" aria-modal="true" aria-labelledby="monitoring-live-title">
        <button className="monitoring-live-backdrop" type="button" onClick={closeLive} aria-label="라이브 화면 닫기" />
        <section className="monitoring-live-panel" aria-live="polite">
          <div className="monitoring-live-heading">
            <div>
              <span className="workspace-eyebrow"><Radio size={14} /> LIVE MONITORING</span>
              <h2 id="monitoring-live-title">{currentLiveExaminee.name} 응시자 라이브 화면</h2>
              <p>정면 영상의 박스는 2초 주기 최신 AI 분석 결과와 동기화됩니다.</p>
            </div>
            <div className="monitoring-live-actions">
              <button className={'monitoring-live-audio-toggle ' + (microphoneLiveEnabled ? 'active' : '')} type="button" onClick={toggleMicrophoneLive} disabled={!microphoneLiveReady} aria-pressed={microphoneLiveEnabled}>
                <span className={'monitoring-live-audio-wave ' + (microphoneLiveSpeaking ? 'speaking' : '')} aria-hidden="true">
                  {[0.45, 0.72, 1, 0.72, 0.45].map((height, index) => <span key={index} style={{ transform: `scaleY(${Math.max(0.12, microphoneLiveLevel * height)})` }} />)}
                </span>
                <span>{microphoneLiveReady ? (microphoneLiveEnabled ? '마이크 듣기 중' : '마이크 듣기') : '마이크 연결 대기'}</span>
                {microphoneLiveReady && <small>{microphoneLiveSpeaking ? '소리 감지 중' : '무음'}</small>}
              </button>
              <button className="icon-button" type="button" onClick={closeLive} aria-label="라이브 화면 닫기"><X size={18} /></button>
            </div>
          </div>
          <div className="monitoring-live-grid">
            <div className="monitoring-live-surface">
              <span>정면 라이브</span>
              <video ref={frontLiveRef} autoPlay muted playsInline className={'monitoring-live-video ' + (frontLiveReady ? 'connected' : '')} />
              {frontLiveReady && currentLiveAiMonitoring?.detections.length ? <DetectionOverlay detections={currentLiveAiMonitoring.detections} /> : null}
              {frontLiveReady && currentLiveAiMonitoring?.analyzedAt && <time className="monitoring-live-detection-time" dateTime={currentLiveAiMonitoring.analyzedAt}>AI 분석 {new Date(currentLiveAiMonitoring.analyzedAt).toLocaleTimeString('ko-KR')}</time>}
              <Video size={36} />
              <strong>{liveError || '영상 연결 중'}</strong>
              <small>응시자 카메라 스트림을 기다리고 있습니다.</small>
            </div>
            <div className="monitoring-live-surface">
              <span>휴대폰 보조 카메라 라이브</span>
              <video ref={auxiliaryLiveRef} autoPlay muted playsInline className={'monitoring-live-video ' + (auxiliaryLiveReady ? 'connected' : '')} />
              <Video size={36} />
              <strong>{auxiliaryLiveReady ? '영상 연결됨' : '휴대폰 카메라 연결 대기'}</strong>
              <small>QR로 연결한 휴대폰 보조 카메라 스트림을 기다리고 있습니다.</small>
            </div>
            <div className="monitoring-live-surface">
              <span>PC 화면 공유 라이브</span>
              <video ref={screenLiveRef} autoPlay muted playsInline className={'monitoring-live-video ' + (screenLiveReady ? 'connected' : '')} />
              <Monitor size={36} />
              <strong>{liveError || '영상 연결 중'}</strong>
              <small>응시자 화면 공유 스트림을 기다리고 있습니다.</small>
            </div>
          </div>
          <audio ref={microphoneLiveRef} autoPlay muted className="monitoring-live-audio" aria-label="응시자 마이크 오디오" />
          <div className="monitoring-live-tools">
            <section className="monitoring-live-tool-panel">
              <div className="monitoring-live-tool-heading"><strong>AI 분석</strong>{currentLiveAiMonitoring?.analyzedAt && <time dateTime={currentLiveAiMonitoring.analyzedAt}>{new Date(currentLiveAiMonitoring.analyzedAt).toLocaleTimeString('ko-KR')}</time>}</div>
              {currentLiveAiMonitoring ? <><p>{currentLiveAiMonitoring.personCount === null ? '사람 수 미확인' : `사람 ${currentLiveAiMonitoring.personCount}명`} · {currentLiveAiMonitoring.model}</p>{currentLiveAiMonitoring.events.length ? <div className="monitoring-ai-events">{currentLiveAiMonitoring.events.map((event) => <span key={event.type}>{event.label} {Math.round(event.confidence * 100)}%</span>)}</div> : <small>현재 감지 이벤트가 없습니다.</small>}</> : <p className="empty-state">AI 분석 결과를 기다리고 있습니다.</p>}
            </section>
            <section className="monitoring-live-tool-panel">
              <div className="monitoring-live-tool-heading"><strong>감시 로그</strong><button type="button" onClick={() => setWarningLogExaminee(currentLiveExaminee)}>전체 보기</button></div>
              {currentLiveWarnings.length ? <ol className="monitoring-live-log-preview">{currentLiveWarnings.slice(0, 3).map((warning) => <li key={warning.id}><span className={'monitoring-source-badge source-' + String(warning.source ?? 'UNKNOWN').toLowerCase()}>{warningSourceLabel(warning.source)}</span><p>{warning.message}</p><time dateTime={warning.createdAt}>{new Date(warning.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol> : <p className="empty-state">기록된 감시 로그가 없습니다.</p>}
            </section>
            <section className="monitoring-live-tool-panel monitoring-live-warning-panel">
              <div><strong>응시자 경고</strong><p>라이브 화면을 확인하면서 응시자에게 경고 메시지를 전송합니다.</p></div>
              <button className="btn-secondary warning-action" type="button" onClick={() => sendWarning(currentLiveExaminee)}>경고 메시지 발송</button>
            </section>
          </div>
        </section>
      </div>}
      {warningLogExaminee && <div className="monitoring-live-modal" role="dialog" aria-modal="true" aria-labelledby="monitoring-warning-log-title">
        <button className="monitoring-live-backdrop" type="button" onClick={closeWarningLog} aria-label="AI 감시 전체 로그 닫기" />
        <section className="monitoring-warning-log-panel">
          <div className="monitoring-live-heading">
            <div>
              <span className="workspace-eyebrow"><AlertTriangle size={14} /> MONITORING LOG</span>
              <h2 id="monitoring-warning-log-title">{warningLogExaminee.name} 응시자 전체 감시 로그</h2>
              <p>최신 기록부터 표시됩니다.</p>
            </div>
            <button className="icon-button" type="button" onClick={closeWarningLog} aria-label="AI 감시 전체 로그 닫기"><X size={18} /></button>
          </div>
          {warningsFor(warningLogExaminee.id).length ? <ol className="monitoring-warning-log-list">{warningsFor(warningLogExaminee.id).map((warning) => <li key={warning.id}><div><span className={'monitoring-source-badge source-' + String(warning.source ?? 'UNKNOWN').toLowerCase()}>{warningSourceLabel(warning.source)}</span><strong>{warning.source === 'SUPERVISOR' ? `발송메시지 - ${warning.message}` : warning.message}</strong></div><time dateTime={warning.createdAt}>{new Date(warning.createdAt).toLocaleString('ko-KR')}</time></li>)}</ol> : <p className="empty-state">기록된 감시 로그가 없습니다.</p>}
        </section>
      </div>}
      {selectedExamId && <section className="data-panel monitoring-candidate-panel" aria-labelledby="monitoring-candidate-list-title">
        <div className="monitoring-candidate-toolbar">
          <div>
            <h2 id="monitoring-candidate-list-title">응시자 목록</h2>
            <span>{visibleExaminees.length} / {examinees.length}명</span>
          </div>
          <label className="monitoring-candidate-search"><Search size={15} /><span className="sr-only">응시자 이름 검색</span><input value={candidateQuery} onChange={(event) => {
            setCandidateQuery(event.target.value);
            setSelectedExamineeId('');
          }} placeholder="응시자 이름 검색" />{candidateQuery && <button type="button" onClick={() => {
            setCandidateQuery('');
            setSelectedExamineeId('');
          }} aria-label="응시자 검색 지우기"><X size={15} /></button>}</label>
          <label className="monitoring-candidate-sort"><span>정렬</span><select value={candidateSort} onChange={(event) => setCandidateSort(event.target.value)}>
            <option value="attention">주의 필요 순</option>
            <option value="warnings">감시 로그 많은 순</option>
            <option value="name">이름 순</option>
          </select></label>
        </div>
        <div className="monitoring-grid">
        {visibleExaminees.map((examinee) => {
          const examineeWarnings = warningsFor(examinee.id);
          const latestWarning = examineeWarnings[0];
          const webcamConnected = Boolean(examinee.mediaStatus?.webcam);
          const microphoneConnected = Boolean(examinee.mediaStatus?.microphone);
          const screenConnected = Boolean(examinee.mediaStatus?.screen);
          const auxiliaryConnected = Boolean(examinee.mediaStatus?.auxiliaryCamera);
          const aiMonitoring = normalizeAiMonitoring(examinee.monitoringSnapshot);
          return <article key={examinee.id} className={'monitoring-card ' + (selectedExamineeId === examinee.id ? 'selected ' : '') + examinee.status.toLowerCase() + (aiMonitoring?.events.length ? ' ai-alert' : '')}>
            <div className="monitoring-card-heading">
              <strong>{examinee.name} 응시자</strong>
              <span className={'status-badge ' + (examinee.status === 'NORMAL' ? 'approved' : examinee.status.toLowerCase())}>{examinee.statusText}</span>
            </div>
            <div className="monitoring-media-status">
              <span className={webcamConnected ? 'connected' : ''}>웹캠 {webcamConnected ? '연결' : '대기'}</span>
              <span className={auxiliaryConnected ? 'connected' : ''}>보조카메라 {auxiliaryConnected ? '연결' : '대기'}</span>
              <span className={microphoneConnected ? 'connected' : ''}>마이크 {microphoneConnected ? '연결' : '대기'}</span>
              <span className={screenConnected ? 'connected' : ''}>PC 화면공유 {screenConnected ? '연결' : '대기'}</span>
            </div>
            <div className="monitoring-video-grid">
              <button className="monitoring-snapshot" type="button" onClick={() => openLive(examinee)} aria-label={examinee.name + ' 응시자의 정면 라이브 화면 열기'}>
                <span>정면 화면</span>{webcamConnected && examinee.monitoringSnapshot?.image ? <><img src={examinee.monitoringSnapshot.image} alt={examinee.name + ' 응시자 웹캠 정지 화면'} />{aiMonitoring?.detections.length ? <DetectionOverlay detections={aiMonitoring.detections} /> : null}</> : <Video size={24} />}<small>{webcamConnected ? `정지 화면 · ${snapshotTime}` : '웹캠 연결 안 됨'}</small>
              </button>
              <button className="monitoring-snapshot" type="button" onClick={() => openLive(examinee)} aria-label={examinee.name + ' 응시자의 보조 라이브 화면 열기'}>
                <span>보조 모니터링</span>{auxiliaryConnected && examinee.auxiliarySnapshot?.image ? <img src={examinee.auxiliarySnapshot.image} alt={examinee.name + ' 응시자 휴대폰 보조 카메라 정지 화면'} /> : <Video size={24} />}<small>{auxiliaryConnected ? `정지 화면 · ${snapshotTime}` : '모바일 보조 카메라 연결 안 됨'}</small>
              </button>
              <button className="monitoring-snapshot" type="button" onClick={() => openLive(examinee)} aria-label={examinee.name + ' 응시자의 PC 화면 공유 라이브 화면 열기'}>
                <span>PC 화면 공유</span><Monitor size={24} /><small>{screenConnected ? '화면 공유 연결됨 · 클릭하여 라이브 보기' : '화면 공유 연결 안 됨'}</small>
              </button>
            </div>
            <div className="monitoring-status-row"><span>진행 현황</span><strong>{examinee.currentProb}</strong><small><Clock3 size={13} /> 2초마다 갱신</small></div>
            {aiMonitoring && <div className="monitoring-ai-summary"><div><strong>AI 분석</strong><span>{aiMonitoring.personCount === null ? '사람 수 미확인' : `사람 ${aiMonitoring.personCount}명`} · {aiMonitoring.model}</span></div>{aiMonitoring.events.length ? <div className="monitoring-ai-events">{aiMonitoring.events.map((event) => <span key={event.type}>{event.label} {Math.round(event.confidence * 100)}%</span>)}</div> : <small>최근 분석에서 감지 이벤트가 없습니다.</small>}{aiMonitoring.analyzedAt && <time dateTime={aiMonitoring.analyzedAt}>{new Date(aiMonitoring.analyzedAt).toLocaleTimeString('ko-KR')} 분석</time>}</div>}
            <button className="monitoring-alert-log" type="button" onClick={() => setWarningLogExaminee(examinee)} aria-label={examinee.name + ' 응시자의 전체 감시 로그 보기'}>
              <div><strong><AlertTriangle size={15} /> 감시 로그</strong><span>{examineeWarnings.length ? `${examineeWarnings.length}건` : '없음'}</span></div>
              {latestWarning ? <div className="monitoring-alert-caption"><span className="monitoring-alert-ticker">{latestWarning.message}</span><time dateTime={latestWarning.createdAt}>{new Date(latestWarning.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div> : <p>현재 기록된 부정행위 의심 알림이 없습니다.</p>}
            </button>
            <button className="btn-secondary warning-action" type="button" onClick={() => sendWarning(examinee)}>경고 메시지 발송</button>
          </article>;
        })}
        {candidateQuery && !visibleExaminees.length && <div className="empty-state monitoring-filter-empty">검색된 응시자가 없습니다.</div>}
        </div>
      </section>}
      </div>
    </section>
  );
}

function DetectionOverlay({ detections }) {
  return <div className="monitoring-detection-overlay" aria-label={`AI 객체 탐지 ${detections.length}건`}>{detections.map((detection) => {
    const [x1, y1, x2, y2] = detection.bbox;
    return <span className={'monitoring-detection-box detection-' + detection.label.replace(/\s+/g, '-')} key={detection.id} style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}><b>{detection.displayLabel} {Math.round(detection.confidence * 100)}%</b></span>;
  })}</div>;
}
