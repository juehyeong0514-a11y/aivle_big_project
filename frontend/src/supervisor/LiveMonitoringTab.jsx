import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, Clock3, Monitor, Radio, Video, X } from 'lucide-react';
import { api, apiErrorMessage, authHeaders } from '../api/client';

export default function LiveMonitoringTab() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examinees, setExaminees] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [lastSnapshotAt, setLastSnapshotAt] = useState(null);
  const [liveExaminee, setLiveExaminee] = useState(null);
  const [liveError, setLiveError] = useState('');
  const [frontLiveReady, setFrontLiveReady] = useState(false);
  const [screenLiveReady, setScreenLiveReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const frontLiveRef = useRef(null);
  const screenLiveRef = useRef(null);
  const livePeerRef = useRef(null);

  useEffect(() => {
    api.get('/manager/organizations', { headers: authHeaders() })
      .then(({ data }) => {
        const managedOrganizations = data.filter((organization) => organization.status === 'APPROVED' && organization.canManage);
        setOrganizations(managedOrganizations);
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
      return;
    }
    api.get('/supervisor/exams?organizationId=' + encodeURIComponent(organizationId), { headers: authHeaders() })
      .then(({ data }) => {
        setExams(data);
        setSelectedExamId(data[0]?.id || '');
      })
      .catch((error) => setLoadError(apiErrorMessage(error, '조직의 시험 목록을 불러오지 못했습니다.')));
  }, [organizationId]);

  useEffect(() => {
    if (!selectedExamId) {
      setExaminees([]);
      setWarnings([]);
      setLastSnapshotAt(null);
      setLiveExaminee(null);
      return undefined;
    }
    const loadMonitoringData = () => Promise.all([
      api.get('/supervisor/examinees?examId=' + encodeURIComponent(selectedExamId), { headers: authHeaders() }),
      api.get('/supervisor/warnings?organizationId=' + encodeURIComponent(organizationId) + '&examId=' + encodeURIComponent(selectedExamId), { headers: authHeaders() })
    ])
      .then(([examineeResponse, warningResponse]) => {
        setExaminees(examineeResponse.data);
        setWarnings(warningResponse.data);
        setLastSnapshotAt(new Date());
      })
      .catch((error) => setLoadError(apiErrorMessage(error, '선택한 시험의 응시자 데이터를 불러오지 못했습니다.')));
    loadMonitoringData();
    const timer = window.setInterval(loadMonitoringData, 10000);
    return () => window.clearInterval(timer);
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

  const closeLive = () => {
    livePeerRef.current?.close();
    livePeerRef.current = null;
    setLiveExaminee(null);
    setLiveError('');
    setFrontLiveReady(false);
    setScreenLiveReady(false);
  };

  const openLive = async (examinee) => {
    closeLive();
    setLiveExaminee(examinee);
    try {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      livePeerRef.current = peer;
      peer.addTransceiver('video', { direction: 'recvonly' });
      const screenVideoTransceiver = peer.addTransceiver('video', { direction: 'recvonly' });
      peer.addTransceiver('audio', { direction: 'recvonly' });
      peer.ontrack = (event) => {
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
      const { data } = await api.post('/supervisor/examinees/' + examinee.id + '/live-offers', { offer: peer.localDescription }, { headers: authHeaders() });
      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        try {
          const response = await api.get('/supervisor/live-offers/' + data.id, { headers: authHeaders() });
          if (response.data.answer) {
            window.clearInterval(timer);
            await peer.setRemoteDescription(response.data.answer);
          } else if (Date.now() - startedAt > 30000) {
            window.clearInterval(timer);
            setLiveError('응시자 영상 연결 요청이 만료되었습니다.');
          }
        } catch {
          window.clearInterval(timer);
          setLiveError('응시자 라이브 연결에 실패했습니다.');
        }
      }, 1200);
    } catch {
      setLiveError('라이브 연결을 시작하지 못했습니다.');
    }
  };

  return (
    <section className="workspace-shell">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">화상 모니터링</span>
          <h1>화상 모니터링</h1>
          <p>현재 작업 조직의 시험만 조회하고 응시자 상태를 실시간으로 확인합니다.</p>
        </div>
        <div className="workspace-role-mark manager"><Monitor size={20} /> 시험 감독 관리자</div>
      </div>

      {loadError && <div className="workspace-alert error">{loadError}</div>}
      <div className="data-panel organization-switcher">
        <label><span>관제 조직</span>
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
            <option value="">관제할 조직을 선택하세요</option>
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>
        <span className="organization-scope-note"><Building2 size={15} /> {selectedOrganization ? selectedOrganization.name + ' 소속 시험만 표시' : '배정된 승인 조직만 표시됩니다.'}</span>
      </div>

      <div className="data-panel organization-switcher">
        <label><span>관제할 시험</span>
          <select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)} disabled={!organizationId}>
            <option value="">시험을 선택하세요</option>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
          </select>
        </label>
        <span>{selectedExam ? `${selectedExam.examineeCount}명 관제 중` : '선택한 조직의 시험을 선택하세요.'}</span>
      </div>

      {!organizationId && <div className="data-panel empty-state">관제할 조직을 선택해주세요.</div>}
      {organizationId && !exams.length && <div className="data-panel empty-state">선택한 조직에 등록된 시험이 없습니다.</div>}
      {selectedExamId && !examinees.length && <div className="data-panel empty-state">현재 선택한 시험에서 관제 중인 응시자가 없습니다.</div>}
      {liveExaminee && <div className="monitoring-live-modal" role="dialog" aria-modal="true" aria-labelledby="monitoring-live-title">
        <button className="monitoring-live-backdrop" type="button" onClick={closeLive} aria-label="라이브 화면 닫기" />
        <section className="monitoring-live-panel" aria-live="polite">
          <div className="monitoring-live-heading">
            <div>
              <span className="workspace-eyebrow"><Radio size={14} /> LIVE MONITORING</span>
              <h2 id="monitoring-live-title">{liveExaminee.name} 응시자 라이브 화면</h2>
              <p>카드를 다시 확인하려면 닫기 버튼을 누르세요. 실제 영상 연결 전에는 마지막 상태 화면만 표시됩니다.</p>
            </div>
            <button className="icon-button" type="button" onClick={closeLive} aria-label="라이브 화면 닫기"><X size={18} /></button>
          </div>
          <div className="monitoring-live-grid">
            <div className="monitoring-live-surface">
              <span>정면 라이브</span>
              <video ref={frontLiveRef} autoPlay muted playsInline className={'monitoring-live-video ' + (frontLiveReady ? 'connected' : '')} />
              <Video size={36} />
              <strong>{liveError || '영상 연결 중'}</strong>
              <small>응시자 카메라 스트림을 기다리고 있습니다.</small>
            </div>
            <div className="monitoring-live-surface">
              <span>보조 라이브</span>
              <video ref={screenLiveRef} autoPlay muted playsInline className={'monitoring-live-video ' + (screenLiveReady ? 'connected' : '')} />
              <Monitor size={36} />
              <strong>{liveError || '영상 연결 중'}</strong>
              <small>응시자 화면 공유 스트림을 기다리고 있습니다.</small>
            </div>
          </div>
        </section>
      </div>}
      <div className="monitoring-grid">
        {examinees.map((examinee) => {
          const examineeWarnings = warningsFor(examinee.id);
          const webcamConnected = Boolean(examinee.mediaStatus?.webcam);
          const auxiliaryConnected = Boolean(examinee.mediaStatus?.auxiliaryCamera);
          return <article key={examinee.id} className={'monitoring-card ' + (examineeWarnings.length ? 'warning ' : '') + examinee.status.toLowerCase()}>
            <div className="monitoring-card-heading">
              <strong>{examinee.name} 응시자</strong>
              <span className={'status-badge ' + (examinee.status === 'NORMAL' ? 'approved' : examinee.status.toLowerCase())}>{examinee.statusText}</span>
            </div>
            <div className="monitoring-media-status">
              <span className={examinee.mediaStatus?.webcam ? 'connected' : ''}>웹캠 {examinee.mediaStatus?.webcam ? '연결' : '대기'}</span>
              <span className={examinee.mediaStatus?.microphone ? 'connected' : ''}>마이크 {examinee.mediaStatus?.microphone ? '연결' : '대기'}</span>
              <span className={auxiliaryConnected ? 'connected' : ''}>모바일 보조 카메라 {auxiliaryConnected ? '연결' : '대기'}</span>
            </div>
            <div className="monitoring-video-grid">
              <button className="monitoring-snapshot" type="button" onClick={() => openLive(examinee)} aria-label={examinee.name + ' 응시자의 정면 라이브 화면 열기'}>
                <span>정면 화면</span>{examinee.monitoringSnapshot?.image ? <img src={examinee.monitoringSnapshot.image} alt={examinee.name + ' 응시자 웹캠 정지 화면'} /> : <Video size={24} />}<small>{webcamConnected ? `정지 화면 · ${snapshotTime}` : '웹캠 연결 안 됨'}</small>
              </button>
              <button className="monitoring-snapshot" type="button" onClick={() => openLive(examinee)} aria-label={examinee.name + ' 응시자의 보조 라이브 화면 열기'}>
                <span>보조 모니터링</span><Monitor size={24} /><small>{auxiliaryConnected ? `정지 화면 · ${snapshotTime}` : '모바일 보조 카메라 연결 안 됨'}</small>
              </button>
            </div>
            <div className="monitoring-status-row"><span>진행 현황</span><strong>{examinee.currentProb}</strong><small><Clock3 size={13} /> 10초마다 갱신</small></div>
            <div className="monitoring-alert-log">
              <div><strong><AlertTriangle size={15} /> AI 감시 알림</strong><span>{examineeWarnings.length ? `${examineeWarnings.length}건` : '없음'}</span></div>
              {examineeWarnings.length ? <ul>{examineeWarnings.slice(0, 2).map((warning) => <li key={warning.id}><span>{warning.message}</span><time dateTime={warning.createdAt}>{new Date(warning.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ul> : <p>현재 기록된 부정행위 의심 알림이 없습니다.</p>}
            </div>
            <button className="btn-secondary warning-action" type="button" onClick={() => sendWarning(examinee)}>경고 메시지 발송</button>
          </article>;
        })}
      </div>
    </section>
  );
}
