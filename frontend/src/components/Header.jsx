import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, LogOut, LogIn, User, PlusSquare, FileText,
  Users, ShieldAlert, Cpu, Monitor, Eye, AlertTriangle, BarChart3
} from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const userRole = localStorage.getItem('userRole') || 'GUEST';
  const userEmail = localStorage.getItem('userEmail') || '비회원(게스트)';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];

  const isAdmin = userRole === 'ADMIN';
  const isSupervisor = userRole === 'SUPERVISOR';

  // 권한별 기본 탭 설정
  const getDefaultTab = () => {
    if (isAdmin) return 'EXAM_CREATE';
    if (isSupervisor) return 'LIVE_MONITORING';
    return 'HOME';
  };

  const defaultTab = getDefaultTab();
  const currentTab = location.pathname === '/' ? defaultTab : (searchParams.get('tab') || defaultTab);

  const handleTabClick = (tabName) => {
    if (!isAdmin && !isSupervisor && tabName === 'HOME') {
      navigate('/');
    } else {
      navigate(`/home?tab=${tabName}`);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    alert('로그아웃되었습니다.');
    navigate('/login');
  };

  const isAuthPage = location.pathname === '/login';

  return (
    <header className="header">
      <div className="header-left-group">
        <div className="logo-area" onClick={() => navigate(isAdmin ? '/home?tab=EXAM_CREATE' : isSupervisor ? '/home?tab=LIVE_MONITORING' : '/')}>
          <div className="logo-icon" style={{ width: 34, height: 34 }}>
            <ShieldCheck color="#ffffff" size={20} />
          </div>
          <span className="logo-title">AI 리터러시 역량 테스트 플랫폼</span>
        </div>

        {!isAuthPage && (
          <nav className="header-nav">
            {isAdmin ? (
              /* ================= 1. 관리자 전용 탭 5개 ================= */
              <>
                <button className={`header-tab-btn ${currentTab === 'EXAM_CREATE' ? 'active' : ''}`} onClick={() => handleTabClick('EXAM_CREATE')}>
                  <PlusSquare size={16} style={{ marginRight: 6 }} /> 시험 생성
                </button>
                <button className={`header-tab-btn ${currentTab === 'POLICY_MGMT' ? 'active' : ''}`} onClick={() => handleTabClick('POLICY_MGMT')}>
                  <FileText size={16} style={{ marginRight: 6 }} /> 문제/정책 관리
                </button>
                <button className={`header-tab-btn ${currentTab === 'USER_MGMT' ? 'active' : ''}`} onClick={() => handleTabClick('USER_MGMT')}>
                  <Users size={16} style={{ marginRight: 6 }} /> 응시자 관리
                </button>
                <button className={`header-tab-btn ${currentTab === 'CHEAT_MGMT' ? 'active' : ''}`} onClick={() => handleTabClick('CHEAT_MGMT')}>
                  <ShieldAlert size={16} style={{ marginRight: 6 }} /> 금지사항 관리
                </button>
                <button className={`header-tab-btn ${currentTab === 'AI_CONFIG' ? 'active' : ''}`} onClick={() => handleTabClick('AI_CONFIG')}>
                  <Cpu size={16} style={{ marginRight: 6 }} /> AI 분석 설정
                </button>
              </>
            ) : isSupervisor ? (
              /* ================= 2. 감독관 전용 탭 3개 ================= */
              <>
                <button className={`header-tab-btn ${currentTab === 'LIVE_MONITORING' ? 'active' : ''}`} onClick={() => handleTabClick('LIVE_MONITORING')}>
                  <Monitor size={16} style={{ marginRight: 6 }} /> 실시간 화상 관제
                </button>
                <button className={`header-tab-btn ${currentTab === 'CHEAT_LOGS' ? 'active' : ''}`} onClick={() => handleTabClick('CHEAT_LOGS')}>
                  <AlertTriangle size={16} style={{ marginRight: 6 }} /> 부정행위 감지 로그
                </button>
                <button className={`header-tab-btn ${currentTab === 'EXAM_STATUS' ? 'active' : ''}`} onClick={() => handleTabClick('EXAM_STATUS')}>
                  <BarChart3 size={16} style={{ marginRight: 6 }} /> 응시자 현황 관리
                </button>
                <button className={`header-tab-btn ${currentTab === 'AI_REPORTS' ? 'active' : ''}`} onClick={() => handleTabClick('AI_REPORTS')}>
                  <FileText size={16} style={{ marginRight: 6 }} /> 응시자 AI 리포트 검토
                </button>
              </>
            ) : (
              /* ================= 3. 응시자 / 게스트 전용 탭 ================= */
              <>
                <button className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>홈</button>
                <button className={`header-tab-btn ${currentTab === 'EXAM' ? 'active' : ''}`} onClick={() => handleTabClick('EXAM')}>평가</button>
                <button className={`header-tab-btn ${currentTab === 'CHECK' ? 'active' : ''}`} onClick={() => handleTabClick('CHECK')}>시험 점검</button>
                <button className={`header-tab-btn ${currentTab === 'PRACTICE' ? 'active' : ''}`} onClick={() => handleTabClick('PRACTICE')}>연습문제</button>
                <button className={`header-tab-btn ${currentTab === 'RESULT' ? 'active' : ''}`} onClick={() => handleTabClick('RESULT')}>결과 조회</button>
                <button className={`header-tab-btn ${currentTab === 'NOTICE' ? 'active' : ''}`} onClick={() => handleTabClick('NOTICE')}>공지사항</button>
                <button className={`header-tab-btn ${currentTab === 'FAQ' ? 'active' : ''}`} onClick={() => handleTabClick('FAQ')}>FAQ</button>
              </>
            )}
          </nav>
        )}
      </div>

      <div className="nav-right">
        {userRole && userRole !== 'GUEST' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="header-user-badge">
              <User size={14} color={isAdmin ? '#7c3aed' : isSupervisor ? '#16a34a' : '#2563EB'} />
              <span>
                {userName}님 ({isAdmin ? '관리자' : isSupervisor ? '감독관' : '응시자'})
              </span>
            </div>
            <button className="logout-btn header-logout-btn" onClick={handleLogout}>
              <LogOut size={15} />
              <span>로그아웃</span>
            </button>
          </div>
        ) : (
          <button className="nav-action-btn" onClick={() => navigate('/login')}>
            <LogIn size={15} style={{ marginRight: 4 }} />
            <span>로그인 / 회원가입</span>
          </button>
        )}
      </div>
    </header>
  );
}