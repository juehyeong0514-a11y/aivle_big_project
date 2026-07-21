import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ShieldCheck, LogOut, LogIn, User, PlusSquare, FileText, Users, ShieldAlert, Cpu } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const userRole = localStorage.getItem('userRole');
  const userEmail = localStorage.getItem('userEmail') || '비회원(게스트)';

  // 🌟 오타 수정 완료 (대괄호 -> 소괄호)
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];

  // 🌟 관리자 권한인지 확인
  const isAdmin = userRole === 'ADMIN';

  // 탭 기본값 설정 (관리자는 기본 'EXAM_CREATE', 일반 유저는 'HOME')
  const defaultTab = isAdmin ? 'EXAM_CREATE' : 'HOME';
  const currentTab = location.pathname === '/' ? defaultTab : (searchParams.get('tab') || defaultTab);

  const handleTabClick = (tabName) => {
    if (!isAdmin && tabName === 'HOME') {
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
        {/* 로고 영역 */}
        <div className="logo-area" onClick={() => navigate(isAdmin ? '/home?tab=EXAM_CREATE' : '/')}>
          <div className="logo-icon" style={{ width: 34, height: 34 }}>
            <ShieldCheck color="#ffffff" size={20} />
          </div>
          <span className="logo-title">
            AI 리터러시 역량 테스트 플랫폼
          </span>
        </div>

        {/* 🌟 로그인 페이지가 아닐 때 탭 표시 */}
        {!isAuthPage && (
          <nav className="header-nav">
            {isAdmin ? (
              /* ================= 관리자 전용 상단 탭 5개 ================= */
              <>
                <button
                  className={`header-tab-btn ${currentTab === 'EXAM_CREATE' ? 'active' : ''}`}
                  onClick={() => handleTabClick('EXAM_CREATE')}
                >
                  <PlusSquare size={16} style={{ marginRight: 6 }} /> 시험 생성
                </button>
                <button
                  className={`header-tab-btn ${currentTab === 'POLICY_MGMT' ? 'active' : ''}`}
                  onClick={() => handleTabClick('POLICY_MGMT')}
                >
                  <FileText size={16} style={{ marginRight: 6 }} /> 문제/정책 관리
                </button>
                <button
                  className={`header-tab-btn ${currentTab === 'USER_MGMT' ? 'active' : ''}`}
                  onClick={() => handleTabClick('USER_MGMT')}
                >
                  <Users size={16} style={{ marginRight: 6 }} /> 응시자 관리
                </button>
                <button
                  className={`header-tab-btn ${currentTab === 'CHEAT_MGMT' ? 'active' : ''}`}
                  onClick={() => handleTabClick('CHEAT_MGMT')}
                >
                  <ShieldAlert size={16} style={{ marginRight: 6 }} /> 금지사항 관리
                </button>
                <button
                  className={`header-tab-btn ${currentTab === 'AI_CONFIG' ? 'active' : ''}`}
                  onClick={() => handleTabClick('AI_CONFIG')}
                >
                  <Cpu size={16} style={{ marginRight: 6 }} /> AI 분석 설정
                </button>
              </>
            ) : (
              /* ================= 일반 응시자용 상단 탭 ================= */
              <>
                <button className={`header-tab-btn ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabClick('HOME')}>홈</button>
                <button className={`header-tab-btn ${currentTab === 'EXAM' ? 'active' : ''}`} onClick={() => handleTabClick('EXAM')}>평가</button>
                <button className={`header-tab-btn ${currentTab === 'CHECK' ? 'active' : ''}`} onClick={() => handleTabClick('CHECK')}>시험 점검</button>
                <button className={`header-tab-btn ${currentTab === 'PRACTICE' ? 'active' : ''}`} onClick={() => handleTabClick('PRACTICE')}>연습문제</button>
                <button className={`header-tab-btn ${currentTab === 'NOTICE' ? 'active' : ''}`} onClick={() => handleTabClick('NOTICE')}>공지사항</button>
                <button className={`header-tab-btn ${currentTab === 'FAQ' ? 'active' : ''}`} onClick={() => handleTabClick('FAQ')}>FAQ</button>
              </>
            )}
          </nav>
        )}
      </div>

      {/* 우측 유저 배지 및 로그아웃 버튼 */}
      <div className="nav-right">
        {userRole && userRole !== 'GUEST' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="header-user-badge">
              <User size={14} color="#2563EB" />
              <span>{userName}님 ({isAdmin ? '관리자' : '응시자'})</span>
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