import React, { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, LogOut, LogIn, User, FileText, ClipboardList,
  Users, ShieldAlert, Cpu, Monitor, AlertTriangle, BarChart3, ChevronDown,
  Building2, Megaphone, MessageSquare, HelpCircle
} from 'lucide-react';
import { api, authHeaders } from '../api/client';
import { getInvitationAwarePublicRoute } from './invitationNavigation.mjs';

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
      { key: 'AI_CONFIG', label: '중앙 AI 채점 설정', icon: Cpu },
      { key: 'INVITATION_SETTINGS', label: '초대 링크 설정', icon: FileText },
      { key: 'NOTICE_MANAGEMENT', label: '공지사항 관리', icon: Megaphone },
      { key: 'COMMUNITY', label: '커뮤니티 관리', icon: MessageSquare }
    ]
  }
];

// 2. 매니저 전용 카테고리 그룹 정의
const SUPERVISOR_GROUPS = [
  {
    label: '조직 운영', icon: Building2,
    items: [
      { key: 'MANAGER_WORKSPACE', label: '조직 관리', icon: Users },
      { key: 'COMMUNITY', label: '조직 커뮤니티', icon: MessageSquare }
    ]
  },
  {
    label: '시험 운영', icon: Users,
    items: [
      { key: 'EXAMS', label: '시험 총괄 대시보드', icon: ClipboardList },
      { key: 'NOTICE_MANAGEMENT', label: '공지사항 관리', icon: Megaphone },
      { key: 'EXAM_POLICY', label: '시험 정책 관리', icon: FileText },
      { key: 'EXAM_PROHIBITIONS', label: '시험 금지사항 관리', icon: ShieldAlert }
    ]
  },
  {
    label: '응시자 관리', icon: BarChart3,
    items: [
      { key: 'AI_REPORTS', label: '응시 현황 및 결과', icon: BarChart3 }
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
      <button type="button" className={`header-tab-btn ${isGroupActive ? 'active' : ''}`} aria-label={group.label} title={group.label}>
        <GroupIcon size={16} className="header-tab-icon" />
        <span className="header-tab-label">{group.label}</span>
        <ChevronDown size={14} className="header-tab-chevron" />
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
  const headerRef = useRef(null);
  const navRef = useRef(null);
  const navRightRef = useRef(null);
  const expandedWidthRef = useRef(0);
  const [isCompact, setIsCompact] = useState(false);

  const userRole = localStorage.getItem('userRole') || 'GUEST';
  const userEmail = localStorage.getItem('userEmail') || '비회원(게스트)';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];

  const isAdmin = userRole === 'ADMIN';
  const isSupervisor = userRole === 'SUPERVISOR' || userRole === 'MANAGER';

  // 권한별 기본 탭 설정
  const getDefaultTab = () => 'HOME';

  const defaultTab = getDefaultTab();
  const requestedTab = searchParams.get('tab') || defaultTab;
  const invitationToken = location.pathname === '/exam/enter'
    ? searchParams.get('token')
    : searchParams.get('inviteToken');
  const currentTab = location.pathname.startsWith('/manager/exams') ? 'EXAMS' : location.pathname === '/' ? defaultTab : (requestedTab === 'EXAM_STATUS' ? 'AI_REPORTS' : requestedTab);

  const handleTabClick = (tabName) => {
    if (isSupervisor && tabName === 'EXAMS') {
      navigate('/manager/exams');
      return;
    }
    if (!isAdmin && !isSupervisor) {
      navigate(invitationToken
        ? getInvitationAwarePublicRoute(tabName, invitationToken)
        : tabName === 'HOME' ? '/' : `/home?tab=${tabName}`);
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

  const homeRoute = isAdmin || isSupervisor ? '/home?tab=HOME' : invitationToken
    ? getInvitationAwarePublicRoute('HOME', invitationToken)
    : '/';

  useLayoutEffect(() => {
    const header = headerRef.current;
    const nav = navRef.current;
    const navRight = navRightRef.current;
    if (!header || !nav || !navRight) return undefined;

    const measure = () => {
      const headerRect = header.getBoundingClientRect();

      if (isCompact) {
        if (expandedWidthRef.current && headerRect.width >= expandedWidthRef.current + 24) {
          setIsCompact(false);
        }
        return;
      }

      const navContent = nav.querySelectorAll('.header-tab-label, .header-tab-chevron');
      const lastNavRight = Math.max(
        nav.getBoundingClientRect().right,
        ...Array.from(navContent, (element) => element.getBoundingClientRect().right)
      );
      const accountLeft = navRight.getBoundingClientRect().left;
      const overlap = lastNavRight + 16 - accountLeft;

      if (overlap > 0) {
        expandedWidthRef.current = Math.ceil(headerRect.width + overlap);
        setIsCompact(true);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(navRight);
    return () => observer.disconnect();
  }, [isCompact, userName, userRole]);

  return (
    <header ref={headerRef} className={`header ${isCompact ? 'header--compact' : ''}`}>
      <div className="header-left-group">
        <div className="logo-area" onClick={() => navigate(homeRoute)}>
          <div className="logo-icon" style={{ width: 34, height: 34 }}>
            <ShieldCheck color="#ffffff" size={20} />
          </div>
          <span className="logo-title">AI 리터러시 역량 테스트 플랫폼</span>
        </div>

        {/* 로그인/회원가입 페이지에서도 네비게이션이 보이도록 제어 조건(!isAuthPage) 제거 */}
        <nav ref={navRef} className="header-nav" aria-label="주요 메뉴">
          {isAdmin ? (
            /* ================= 1. 관리자 전용 (그룹 드롭다운) ================= */
            <>
              <button type="button" className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} aria-label="홈" title="홈" onClick={() => handleTabClick('HOME')}>
                <Monitor size={16} className="header-tab-icon" /><span className="header-tab-label">홈</span>
              </button>
              {ADMIN_GROUPS.map((group) => (
                <NavGroup key={group.label} group={group} currentTab={currentTab} onSelect={handleTabClick} />
              ))}
            </>
          ) : isSupervisor ? (
            /* ================= 2. 매니저 전용 (그룹 드롭다운) ================= */
            <>
              <button type="button" className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} aria-label="홈" title="홈" onClick={() => handleTabClick('HOME')}>
                <Monitor size={16} className="header-tab-icon" /><span className="header-tab-label">홈</span>
              </button>
              {SUPERVISOR_GROUPS.map((group) => (
                <NavGroup key={group.label} group={group} currentTab={currentTab} onSelect={handleTabClick} />
              ))}
            </>
          ) : (
            /* ================= 3. 일반 사용자/게스트 전용 ================= */
            <>
              <button type="button" className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} aria-label="홈" title="홈" onClick={() => handleTabClick('HOME')}><Monitor size={16} className="header-tab-icon" /><span className="header-tab-label">홈</span></button>
              <button type="button" className={`header-tab-btn ${currentTab === 'NOTICE' ? 'active' : ''}`} aria-label="공지사항" title="공지사항" onClick={() => handleTabClick('NOTICE')}><Megaphone size={16} className="header-tab-icon" /><span className="header-tab-label">공지사항</span></button>
              <button type="button" className={`header-tab-btn ${currentTab === 'FAQ' ? 'active' : ''}`} aria-label="FAQ" title="FAQ" onClick={() => handleTabClick('FAQ')}><HelpCircle size={16} className="header-tab-icon" /><span className="header-tab-label">FAQ</span></button>
            </>
          )}
        </nav>
      </div>

      <div ref={navRightRef} className="nav-right">
        {userRole && userRole !== 'GUEST' ? (
          <div className="header-account-actions">
            <div className="header-user-badge">
              <User size={14} color={isAdmin ? '#7c3aed' : isSupervisor ? '#16a34a' : '#2563EB'} />
              <span>
                {userName}님{!isAdmin && ` (${isSupervisor ? '매니저' : '응시자'})`}
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
