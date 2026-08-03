import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, LogOut, LogIn, User, FileText, ClipboardList,
  Users, ShieldAlert, Cpu, Monitor, BarChart3, ChevronDown,
  Building2, Megaphone, MessageSquare, HelpCircle
} from 'lucide-react';
import { api, authHeaders } from '../api/client';
import { getInvitationAwarePublicRoute, getInvitationContextToken } from './invitationNavigation.mjs';

// 1. 관리자 전용 카테고리 그룹 정의
const ADMIN_GROUPS = [
  {
    label: '공지사항', icon: Megaphone,
    items: [
      { key: 'NOTICE', label: '공지사항', icon: Megaphone },
      { key: 'NOTICE_MANAGEMENT', label: '공지사항 관리', icon: Megaphone }
    ]
  },
  {
    label: '조직·관리자', icon: Building2,
    items: [
      { key: 'GOVERNANCE', label: '조직 승인 및 관리자 관리', icon: ShieldCheck },
      { key: 'USER_MGMT', label: '응시자·결과 조회', icon: Users },
      { key: 'COMMUNITY', label: '조직 커뮤니티', icon: MessageSquare }
    ]
  },
  {
    label: '시험 조회 및 설정', icon: ClipboardList,
    items: [
      { key: 'AI_CONFIG', label: '중앙 AI 채점 설정', icon: Cpu },
      { key: 'INVITATION_SETTINGS', label: '초대 링크 설정', icon: FileText },

    ]
  }
];

// 2. 매니저 전용 카테고리 그룹 정의
const SUPERVISOR_GROUPS = [
  {
    label: '공지사항', icon: Megaphone,
    items: [
      { key: 'NOTICE', label: '공지사항', icon: Megaphone },
      { key: 'NOTICE_MANAGEMENT', label: '공지사항 관리', icon: Megaphone }
    ]
  },
  {
    label: '조직 운영',
    icon: Building2,
    items: [
      { key: 'MANAGER_WORKSPACE', label: '조직 관리', icon: Users },
      { key: 'COMMUNITY', label: '조직 커뮤니티', icon: MessageSquare }
    ]
  },
  {
    label: '시험 운영',
    icon: Users,
    items: [
      { key: 'EXAMS', label: '시험 총괄 대시보드', icon: ClipboardList },
      { key: 'EXAM_PROHIBITIONS', label: '시험 금지사항 관리', icon: ShieldAlert }
    ]
  },
  {
    label: '실시간 관제 및 검토',
    icon: Monitor,
    items: [
      { key: 'LIVE_MONITORING', label: '화상 모니터링', icon: Monitor },
      { key: 'AI_REPORTS', label: '응시자 관리', icon: BarChart3 }
    ]
  }
];

// 카테고리별 드롭다운 그룹 컴포넌트 (마우스 호버 지원)
function NavGroup({ group, currentTab, onSelect }) {
  const GroupIcon = group.icon;
  const isGroupActive = group.items.some((item) => item.key === currentTab);

  return (
    <div className="header-nav-group" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        className={`header-tab-btn ${isGroupActive ? 'active' : ''}`}
        aria-label={group.label}
        title={group.label}
        onClick={(event) => {
          if (event.detail > 0) event.currentTarget.blur();
        }}
      >
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
  const [candidateName, setCandidateName] = useState(() => sessionStorage.getItem('candidateInvitationName') || '');

  const userRole = localStorage.getItem('userRole') || 'GUEST';
  const userEmail = localStorage.getItem('userEmail') || '비회원(게스트)';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];

  const isAdmin = userRole === 'ADMIN';
  const isSupervisor = userRole === 'SUPERVISOR' || userRole === 'MANAGER';

  // 권한별 기본 탭 설정
  const getDefaultTab = () => 'HOME';

  const defaultTab = getDefaultTab();
  const requestedTab = searchParams.get('tab') || defaultTab;
  const normalizedRequestedTab = requestedTab === 'EXAM_POLICY' ? 'EXAMS' : requestedTab;
  const invitationToken = getInvitationContextToken(
    location.pathname,
    searchParams.get('token'),
    searchParams.get('inviteToken'),
    sessionStorage.getItem('candidateInvitationToken'),
    Boolean(localStorage.getItem('candidateAccessToken'))
  );
  const currentTab = location.pathname.startsWith('/manager/exams') ? 'EXAMS' : location.pathname === '/' ? defaultTab : (normalizedRequestedTab === 'EXAM_STATUS' ? 'AI_REPORTS' : normalizedRequestedTab === 'CHEAT_LOGS' ? 'LIVE_MONITORING' : normalizedRequestedTab);
  const isCandidateInvitation = Boolean(invitationToken && candidateName);

  useEffect(() => {
    const syncCandidateName = () => setCandidateName(sessionStorage.getItem('candidateInvitationName') || '');
    window.addEventListener('candidate-invitation-updated', syncCandidateName);
    return () => window.removeEventListener('candidate-invitation-updated', syncCandidateName);
  }, []);

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
    sessionStorage.removeItem('candidateInvitationToken');
    sessionStorage.removeItem('candidateInvitationName');
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
  }, [candidateName, isCompact, userName, userRole]);

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
              <button
  type="button"
  className={`header-tab-btn ${currentTab === 'NOTICE_MANAGEMENT' ? 'active' : ''}`}
  style={{ display: 'none' }}
  aria-label="공지사항 관리"
  title="공지사항 관리"
  onClick={() => handleTabClick('NOTICE_MANAGEMENT')}
>
  <Megaphone size={16} className="header-tab-icon" />
  <span className="header-tab-label">공지사항 관리</span>
</button>

<button
  type="button"
  className={`header-tab-btn ${currentTab === 'COMMUNITY' ? 'active' : ''}`}
  style={{ display: 'none' }}
  aria-label="커뮤니티 관리"
  title="커뮤니티 관리"
  onClick={() => handleTabClick('COMMUNITY')}
>
  <MessageSquare size={16} className="header-tab-icon" />
  <span className="header-tab-label">커뮤니티 관리</span>
</button>
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
              <button
  type="button"
  className={`header-tab-btn ${currentTab === 'AI_REPORTS' ? 'active' : ''}`}
  style={{ display: 'none' }}
  aria-label="응시자 관리"
  title="응시자 관리"
  onClick={() => handleTabClick('AI_REPORTS')}
>
  <BarChart3 size={16} className="header-tab-icon" />
  <span className="header-tab-label">응시자 관리</span>
</button>
              <button
  type="button"
  className={`header-tab-btn ${currentTab === 'NOTICE_MANAGEMENT' ? 'active' : ''}`}
  style={{ display: 'none' }}
  aria-label="공지사항 관리"
  title="공지사항 관리"
  onClick={() => handleTabClick('NOTICE_MANAGEMENT')}
>
  <Megaphone size={16} className="header-tab-icon" />
  <span className="header-tab-label">공지사항 관리</span>
</button>

<button
  type="button"
  className={`header-tab-btn ${currentTab === 'COMMUNITY' ? 'active' : ''}`}
  style={{ display: 'none' }}
  aria-label="커뮤니티 관리"
  title="커뮤니티 관리"
  onClick={() => handleTabClick('COMMUNITY')}
>
  <MessageSquare size={16} className="header-tab-icon" />
  <span className="header-tab-label">커뮤니티 관리</span>
</button>
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
        {isCandidateInvitation ? (
          <div className="header-user-badge"><User size={14} color="#2563EB" /><span>{candidateName}님</span></div>
        ) : userRole && userRole !== 'GUEST' ? (
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
