import React, { lazy, Suspense } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

// 🌟 관리자 전용 탭 컴포넌트 임포트
const AdminGovernanceTab = lazy(() => import('../admin/AdminGovernanceTab'));
const UserMgmtTab = lazy(() => import('../admin/UserMgmtTab'));
const AiConfigTab = lazy(() => import('../admin/AiConfigTab'));
const InvitationSettingsTab = lazy(() => import('../admin/InvitationSettingsTab'));
const ManagerWorkspaceTab = lazy(() => import('../manager/ManagerWorkspaceTab'));

// 🌟 응시자 전용 탭 컴포넌트 임포트
const HomeTab = lazy(() => import('../applicant/HomeTab'));
const ExamTab = lazy(() => import('../applicant/ExamTab'));
const CheckTab = lazy(() => import('../applicant/CheckTab'));
const PracticeTab = lazy(() => import('../applicant/PracticeTab'));
const NoticeTab = lazy(() => import('../applicant/NoticeTab'));
const FaqTab = lazy(() => import('../applicant/FaqTab'));

// 🌟 감독관 전용 탭 컴포넌트 임포트
const LiveMonitoringTab = lazy(() => import('../supervisor/LiveMonitoringTab'));
const CheatLogsTab = lazy(() => import('../supervisor/CheatLogsTab'));
const ExamStatusTab = lazy(() => import('../supervisor/ExamStatusTab'));
const SupervisorReportsTab = lazy(() => import('../supervisor/ReportsTab'));
const ExamPolicyTab = lazy(() => import('../supervisor/ExamPolicyTab'));
const SupervisorExamDashboard = lazy(() => import('../supervisor/SupervisorExamDashboard'));

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const userRole = location.state?.role || localStorage.getItem('userRole') || 'GUEST';

  const isAdmin = userRole === 'ADMIN';
  const isSupervisor = userRole === 'SUPERVISOR' || userRole === 'MANAGER';

  // 🌟 권한별 기본 탭 설정
  const getDefaultTab = () => 'HOME';

  const defaultTab = getDefaultTab();
  const requestedTab = location.pathname === '/' ? defaultTab : (searchParams.get('tab') || defaultTab);
  const protectedGuestTabs = new Set(['EXAM', 'CHECK', 'PRACTICE']);
  const activeTab = userRole === 'GUEST' && protectedGuestTabs.has(requestedTab)
    ? defaultTab
    : requestedTab === 'RESULT' ? defaultTab : requestedTab === 'EXAM_CREATE' ? 'EXAMS' : requestedTab;
  const showHome = activeTab === 'HOME';

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
        <Suspense fallback={<div className="workspace-loading">화면을 불러오는 중입니다...</div>}>

        {/* =========================================================================
            🛡️ [관리자(ADMIN) 전용 탭 라우팅 허브]
            ========================================================================= */}
        {isAdmin && !showHome && (
          <div>
            {activeTab === 'GOVERNANCE' && <AdminGovernanceTab />} 
            {activeTab === 'USER_MGMT' && <UserMgmtTab />} 
            {activeTab === 'AI_CONFIG' && <AiConfigTab />}
            {activeTab === 'INVITATION_SETTINGS' && <InvitationSettingsTab />}
          </div>
        )}

        {/* =========================================================================
            👁️ [감독관(SUPERVISOR) 전용 탭 라우팅 허브] 🌟 새로 추가됨
            ========================================================================= */}
        {isSupervisor && !showHome && (
          <div>
            {activeTab === 'MANAGER_WORKSPACE' && <ManagerWorkspaceTab />} 
            {activeTab === 'EXAMS' && <SupervisorExamDashboard />}
            {activeTab === 'LIVE_MONITORING' && <LiveMonitoringTab />}
            {activeTab === 'CHEAT_LOGS' && <CheatLogsTab />}
            {activeTab === 'EXAM_STATUS' && <ExamStatusTab />}
            {activeTab === 'AI_REPORTS' && <SupervisorReportsTab />}
            {activeTab === 'EXAM_POLICY' && <ExamPolicyTab />}
            {activeTab === 'EXAM_PROHIBITIONS' && <ExamPolicyTab prohibitions />}
          </div>
        )}
        </Suspense>

        {/* =========================================================================
            👤 [일반 응시자 / 게스트 전용 탭 라우팅 허브]
            ========================================================================= */}
        {showHome && <HomeTab />}

        {!isAdmin && !isSupervisor && !showHome && (
          <>
            {/* 타이틀 및 비회원 경고 바 (HOME이 아닐 때만 렌더링) */}
            {activeTab !== 'HOME' && (
              <div className="content-header-bar" style={{ marginBottom: '2rem' }}>
                <h1 className="content-main-title" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0f172a' }}>
                  {activeTab === 'EXAM' && '평가 목록'}
                  {activeTab === 'CHECK' && '사전 환경 점검 안내'}
                  {activeTab === 'PRACTICE' && '연습문제 목록'}
                  {activeTab === 'NOTICE' && '공지사항'}
                  {activeTab === 'FAQ' && '자주 묻는 질문 (FAQ)'}
                </h1>
                {userRole === 'GUEST' && (
                  <span className="badge-status alert-error" style={{ display: 'inline-block', marginTop: '0.5rem' }}>
                    비회원에게는 공지사항과 FAQ만 제공됩니다. 시험 기능은 초대받은 응시자만 이용할 수 있습니다.
                  </span>
                )}
              </div>
            )}

            {/* 각 응시자 탭 컴포넌트 렌더링 */}
            {activeTab === 'HOME' && <HomeTab />}
            {activeTab === 'EXAM' && <ExamTab onProtectedAction={handleProtectedAction} />}
            {activeTab === 'CHECK' && <CheckTab onProtectedAction={handleProtectedAction} />}
            {activeTab === 'PRACTICE' && <PracticeTab onProtectedAction={handleProtectedAction} />}
            {activeTab === 'NOTICE' && <NoticeTab />}
            {activeTab === 'FAQ' && <FaqTab />}
          </>
        )}

      </main>
    </div>
  );
}
