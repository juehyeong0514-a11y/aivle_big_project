import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ShieldCheck, LogOut, LogIn, User } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'EXAM';
  const userRole = localStorage.getItem('userRole');
  const userEmail = localStorage.getItem('userEmail') || '비회원(게스트)';

  const handleTabClick = (tabName) => {
    navigate(`/home?tab=${tabName}`);
  };

  const handleLogout = () => {
    localStorage.clear();
    alert('로그아웃되었습니다.');
    navigate('/login');
  };

  const isAuthOrLanding = location.pathname === '/' || location.pathname === '/login';

  return (
    <header className="header">
      {/* 1. 좌측 로고 + 네비게이션 탭을 묶는 그룹 */}
      <div className="header-left-group">

        {/* 로고 영역 */}
        <div className="logo-area" onClick={() => navigate('/home?tab=EXAM')}>
          <div className="logo-icon" style={{ width: 34, height: 34 }}>
            <ShieldCheck color="#ffffff" size={20} />
          </div>
          <span className="logo-title">AI 리터러시 역량 테스트</span>
        </div>

        {/* 네비게이션 탭 (아이콘 제거 및 심플 텍스트 화) */}
        {!isAuthOrLanding && (
          <nav className="header-nav">
            <button
              className={`header-tab-btn ${currentTab === 'EXAM' ? 'active' : ''}`}
              onClick={() => handleTabClick('EXAM')}
            >
              평가
            </button>

            <button
              className={`header-tab-btn ${currentTab === 'CHECK' ? 'active' : ''}`}
              onClick={() => handleTabClick('CHECK')}
            >
              시험 점검
            </button>

            <button
              className={`header-tab-btn ${currentTab === 'PRACTICE' ? 'active' : ''}`}
              onClick={() => handleTabClick('PRACTICE')}
            >
              연습문제
            </button>

            <button
              className={`header-tab-btn ${currentTab === 'NOTICE' ? 'active' : ''}`}
              onClick={() => handleTabClick('NOTICE')}
            >
              공지사항
            </button>

            <button
              className={`header-tab-btn ${currentTab === 'FAQ' ? 'active' : ''}`}
              onClick={() => handleTabClick('FAQ')}
            >
              FAQ
            </button>
          </nav>
        )}
      </div>

      {/* 2. 우측 유저 상태 및 로그인/로그아웃 버튼 */}
      <div className="nav-right">
        {userRole && userRole !== 'GUEST' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="header-user-badge">
              <User size={14} color="#2563EB" />
              <span>{userEmail.split('@')[0]}님</span>
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