import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, LogOut, LogIn, User, FileText, ClipboardList,
  Users, ShieldAlert, Cpu, Monitor, AlertTriangle, BarChart3, ChevronDown,
  Building2
} from 'lucide-react';
import { api, authHeaders } from '../api/client';

// 1. 관리자 전용 카테고리 그룹 정의
const ADMIN_GROUPS = [
  {
    label: '조직·관리자', icon: Building2,
    items: [
      { key: 'GOVERNANCE', label: '조직 승인 및 관리자 관리', icon: ShieldCheck },
      { key: 'USER_MGMT', label: '응시자 관리', icon: Users }
    ]
  },
  {
    label: '시험 조회 및 설정', icon: ClipboardList,
    items: [
      { key: 'AI_CONFIG', label: 'AI 분석 설정', icon: Cpu },
      { key: 'INVITATION_SETTINGS', label: '초대 링크 설정', icon: FileText }
    ]
  }
];

// 2. 감독관(매니저) 전용 카테고리 그룹 정의
const SUPERVISOR_GROUPS = [
  {
    label: '조직 및 시험 운영', icon: Users,
    items: [
      { key: 'MANAGER_WORKSPACE', label: '조직 운영', icon: Users },
      { key: 'EXAM_MANAGEMENT', label: '시험 관리', icon: ClipboardList },
      { key: 'EXAMS', label: '전체 시험 조회', icon: ClipboardList },
      { key: 'EXAM_POLICY', label: '시험 정책 관리', icon: FileText },
      { key: 'EXAM_PROHIBITIONS', label: '시험 금지사항 관리', icon: ShieldAlert },
      { key: 'EXAM_STATUS', label: '응시자 현황 관리', icon: BarChart3 },
      { key: 'AI_REPORTS', label: '응시자 결과 관리', icon: FileText }
    ]
  },
  {
    label: '실시간 관제 및 검토', icon: Monitor,
    items: [
      { key: 'LIVE_MONITORING', label: '화상 모니터링', icon: Monitor },
      { key: 'CHEAT_LOGS', label: '부정행위 감지 로그', icon: AlertTriangle }
    ]
  }
];

// 카테고리별 드롭다운 그룹 컴포넌트 (마우스 호버 지원)
function NavGroup({ group, currentTab, onSelect }) {
  const GroupIcon = group.icon;
  const isGroupActive = group.items.some((item) => item.key === currentTab);

  return (
    <div className="header-nav-group" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
      <button type="button" className={`header-tab-btn ${isGroupActive ? 'active' : ''}`}>
        <GroupIcon size={16} style={{ marginRight: 6 }} /> {group.label}
        <ChevronDown size={14} style={{ marginLeft: 4 }} />
      </button>
      <div className="header-nav-dropdown">
        {group.items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`header-nav-dropdown-item ${currentTab === key ? 'active' : ''}`}
            onClick={(event) => { event.currentTarget.blur(); onSelect(key); }}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const getDefaultTab = () => 'HOME';

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

  const homeRoute = isAdmin || isSupervisor ? '/home?tab=HOME' : '/';

  return (
    <header className="header" style={{ overflow: 'visible' }}>
      <div className="header-left-group" style={{ overflow: 'visible' }}>
        <div className="logo-area" onClick={() => navigate(homeRoute)}>
          <div className="logo-icon" style={{ width: 34, height: 34 }}>
            <ShieldCheck color="#ffffff" size={20} />
          </div>
          <span className="logo-title">AI 리터러시 역량 테스트 플랫폼</span>
        </div>

        {/* 로그인/회원가입 페이지에서도 네비게이션이 보이도록 제어 조건(!isAuthPage) 제거 */}
        <nav className="header-nav" style={{ overflow: 'visible' }}>
          {isAdmin ? (
            /* ================= 1. 관리자 전용 (그룹 드롭다운) ================= */
            <>
              <button type="button" className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>
                <Monitor size={16} style={{ marginRight: 6 }} /> 홈
              </button>
              {ADMIN_GROUPS.map((group) => (
                <NavGroup key={group.label} group={group} currentTab={currentTab} onSelect={handleTabClick} />
              ))}
            </>
          ) : isSupervisor ? (
            /* ================= 2. 감독관 전용 (그룹 드롭다운) ================= */
            <>
              <button type="button" className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>
                <Monitor size={16} style={{ marginRight: 6 }} /> 홈
              </button>
              {SUPERVISOR_GROUPS.map((group) => (
                <NavGroup key={group.label} group={group} currentTab={currentTab} onSelect={handleTabClick} />
              ))}
            </>
          ) : (
            /* ================= 3. 일반 사용자/게스트 전용 ================= */
            <>
              <button type="button" className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>홈</button>
              <button type="button" className={`header-tab-btn ${currentTab === 'NOTICE' ? 'active' : ''}`} onClick={() => handleTabClick('NOTICE')}>공지사항</button>
              <button type="button" className={`header-tab-btn ${currentTab === 'FAQ' ? 'active' : ''}`} onClick={() => handleTabClick('FAQ')}>FAQ</button>
            </>
          )}
        </nav>
      </div>

      <div className="nav-right">
        {userRole && userRole !== 'GUEST' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="header-user-badge">
              <User size={14} color={isAdmin ? '#7c3aed' : isSupervisor ? '#16a34a' : '#2563EB'} />
              <span>
                {userName}님{!isAdmin && ` (${isSupervisor ? '감독관' : '응시자'})`}
              </span>
            </div>
            <button type="button" className="logout-btn header-logout-btn" onClick={handleLogout}>
              <LogOut size={15} />
              <span>로그아웃</span>
            </button>
          </div>
        ) : (
          <button type="button" className="nav-action-btn" onClick={() => navigate('/login')}>
            <LogIn size={15} style={{ marginRight: 4 }} />
            <span>로그인 / 회원가입</span>
          </button>
        )}
      </div>
    </header>
  );
}
