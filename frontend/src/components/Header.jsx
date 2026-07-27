import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, LogOut, LogIn, User, FileText, ClipboardList,
  Users, ShieldAlert, Cpu, Monitor, AlertTriangle, BarChart3
} from 'lucide-react';
import { api, authHeaders } from '../api/client';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const userRole = localStorage.getItem('userRole') || 'GUEST';
  const userEmail = localStorage.getItem('userEmail') || '비회원(게스트)';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];

  const isAdmin = userRole === 'ADMIN';
  const isSupervisor = userRole === 'SUPERVISOR' || userRole === 'MANAGER';

  // 권한별 기본 탭 설정
  const getDefaultTab = () => {
    return 'HOME';
  };

  const defaultTab = getDefaultTab();
  const currentTab = location.pathname.startsWith('/manager/exams') ? 'EXAM_MANAGEMENT' : location.pathname === '/' ? defaultTab : (searchParams.get('tab') || defaultTab);

  const handleTabClick = (tabName) => {
    if (isSupervisor && tabName === 'EXAM_MANAGEMENT') {
      navigate('/manager/exams');
      return;
    }
    if (!isAdmin && !isSupervisor && tabName === 'HOME') {
      navigate('/');
    } else {
      navigate(`/home?tab=${tabName}`);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', null, { headers: authHeaders() });
    } catch (error) {
      console.warn('로그아웃 요청을 완료하지 못했지만 로컬 세션을 정리합니다.', error);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('candidateAccessToken');
    localStorage.removeItem('candidateNumber');
    alert('로그아웃되었습니다.');
    navigate('/login');
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  const homeRoute = isAdmin || isSupervisor ? '/home?tab=HOME' : '/';

  return (
    <header className="header">
      <div className="header-left-group">
        <div className="logo-area" onClick={() => navigate(homeRoute)}>
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
                <button className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>
                  <Monitor size={16} style={{ marginRight: 6 }} /> 홈
                </button>
                <button className={`header-tab-btn ${currentTab === 'GOVERNANCE' ? 'active' : ''}`} onClick={() => handleTabClick('GOVERNANCE')}>
                  <ShieldCheck size={16} style={{ marginRight: 6 }} /> 조직 승인 및 관리자 관리
                </button>
                <button className={`header-tab-btn ${currentTab === 'EXAMS' ? 'active' : ''}`} onClick={() => handleTabClick('EXAMS')}>
                  <ClipboardList size={16} style={{ marginRight: 6 }} /> 전체 시험 관리
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
                <button className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>
                  <Monitor size={16} style={{ marginRight: 6 }} /> 홈
                </button>
                <button className={`header-tab-btn ${currentTab === 'MANAGER_WORKSPACE' ? 'active' : ''}`} onClick={() => handleTabClick('MANAGER_WORKSPACE')}>
                  <Users size={16} style={{ marginRight: 6 }} /> 조직 운영
                </button>
                <button className={`header-tab-btn ${currentTab === 'EXAM_MANAGEMENT' ? 'active' : ''}`} onClick={() => handleTabClick('EXAM_MANAGEMENT')}>
                  <ClipboardList size={16} style={{ marginRight: 6 }} /> 시험 관리
                </button>
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
              <>
                <button className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>홈</button>
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
                {userName}님 ({isAdmin ? 'ADMIN' : isSupervisor ? '관리자' : '응시자'})
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
