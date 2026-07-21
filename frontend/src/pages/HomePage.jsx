import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

// 🌟 관리자 전용 탭 컴포넌트 임포트
import ExamCreateTab from '../admin/ExamCreateTab';
import PolicyMgmtTab from '../admin/PolicyMgmtTab';
import UserMgmtTab from '../admin/UserMgmtTab';
import CheatMgmtTab from '../admin/CheatMgmtTab';
import AiConfigTab from '../admin/AiConfigTab';

// 🌟 응시자 전용 탭 컴포넌트 임포트
import HomeTab from '../applicant/HomeTab';
import ExamTab from '../applicant/ExamTab';
import CheckTab from '../applicant/CheckTab';
import PracticeTab from '../applicant/PracticeTab';
import NoticeTab from '../applicant/NoticeTab';
import FaqTab from '../applicant/FaqTab';
import ResultTab from '../applicant/ResultTab';

// 🌟 감독관 전용 탭 컴포넌트 임포트
import LiveMonitoringTab from '../supervisor/LiveMonitoringTab';
import CheatLogsTab from '../supervisor/CheatLogsTab';
import ExamStatusTab from '../supervisor/ExamStatusTab';
import SupervisorReportsTab from '../supervisor/ReportsTab';

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const userRole = location.state?.role || localStorage.getItem('userRole') || 'GUEST';

  const isAdmin = userRole === 'ADMIN';
  const isSupervisor = userRole === 'SUPERVISOR'; // 🌟 감독관 권한 체크 변수 추가

  // 🌟 권한별 기본 탭 설정
  const getDefaultTab = () => {
    if (isAdmin) return 'EXAM_CREATE';
    if (isSupervisor) return 'LIVE_MONITORING';
    return 'HOME';
  };

  const defaultTab = getDefaultTab();
  const activeTab = location.pathname === '/' ? defaultTab : (searchParams.get('tab') || defaultTab);

  const handleProtectedAction = (actionRoute) => {
    if (userRole === 'GUEST') {
      const confirmLogin = window.confirm('🔒 이 기능은 로그인이 필요합니다.\n로그인/회원가입 페이지로 이동하시겠습니까?');
      if (confirmLogin) navigate('/login');
    } else {
      navigate(actionRoute);
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 64px)', padding: '2.5rem 0' }}>
      <main className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>

        {/* =========================================================================
            🛡️ [관리자(ADMIN) 전용 탭 라우팅 허브]
            ========================================================================= */}
        {isAdmin && (
          <div>
            {activeTab === 'EXAM_CREATE' && <ExamCreateTab />}
            {activeTab === 'POLICY_MGMT' && <PolicyMgmtTab />}
            {activeTab === 'USER_MGMT' && <UserMgmtTab />}
            {activeTab === 'CHEAT_MGMT' && <CheatMgmtTab />}
            {activeTab === 'AI_CONFIG' && <AiConfigTab />}
          </div>
        )}

        {/* =========================================================================
            👁️ [감독관(SUPERVISOR) 전용 탭 라우팅 허브] 🌟 새로 추가됨
            ========================================================================= */}
        {isSupervisor && (
          <div>
            {activeTab === 'LIVE_MONITORING' && <LiveMonitoringTab />}
            {activeTab === 'CHEAT_LOGS' && <CheatLogsTab />}
            {activeTab === 'EXAM_STATUS' && <ExamStatusTab />}
            {activeTab === 'AI_REPORTS' && <SupervisorReportsTab />}
          </div>
        )}

        {/* =========================================================================
            👤 [일반 응시자 / 게스트 전용 탭 라우팅 허브]
            ========================================================================= */}
        {!isAdmin && !isSupervisor && (
          <>
            {/* 타이틀 및 비회원 경고 바 (HOME이 아닐 때만 렌더링) */}
            {activeTab !== 'HOME' && (
              <div className="content-header-bar" style={{ marginBottom: '2rem' }}>
                <h1 className="content-main-title" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a' }}>
                  {activeTab === 'EXAM' && '평가 목록'}
                  {activeTab === 'CHECK' && '사전 환경 점검 안내'}
                  {activeTab === 'PRACTICE' && '연습문제 목록'}
                  {activeTab === 'RESULT' && '역량 평가 결과 조회'}
                  {activeTab === 'NOTICE' && '공지사항'}
                  {activeTab === 'FAQ' && '자주 묻는 질문 (FAQ)'}
                </h1>
                {userRole === 'GUEST' && (
                  <span className="badge-status alert-error" style={{ display: 'inline-block', marginTop: '0.5rem' }}>
                    ⚠️ 비회원 상태입니다. 상세 기능 이용 시 로그인이 요구됩니다.
                  </span>
                )}
              </div>
            )}

            {/* 각 응시자 탭 컴포넌트 렌더링 */}
            {activeTab === 'HOME' && <HomeTab />}
            {activeTab === 'EXAM' && <ExamTab onProtectedAction={handleProtectedAction} />}
            {activeTab === 'CHECK' && <CheckTab onProtectedAction={handleProtectedAction} />}
            {activeTab === 'PRACTICE' && <PracticeTab onProtectedAction={handleProtectedAction} />}
            {activeTab === 'RESULT' && <ResultTab />}
            {activeTab === 'NOTICE' && <NoticeTab />}
            {activeTab === 'FAQ' && <FaqTab />}
          </>
        )}

      </main>
    </div>
  );
}