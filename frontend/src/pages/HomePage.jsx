import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Shield, Clock, Video, FileText, Settings, ArrowRight, CheckCircle2,
  BookOpen, Bell, HelpCircle, AlertCircle, Camera, Monitor, QrCode,
  Search, ChevronRight, User, LogOut, Award, LogIn
} from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // 로컬 스토리지에서 사용자 정보 및 권한 가져오기 (없으면 게스트 상태)
  const userRole = location.state?.role || localStorage.getItem('userRole') || 'GUEST';
  const userEmail = localStorage.getItem('userEmail') || '비회원 (게스트)';

  // 현재 활성화된 사이드바 탭 상태
  const [activeTab, setActiveTab] = useState('EXAM');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // [평가 탭] 데이터
  const examList = [
    {
      id: 1,
      title: '2026년 하반기 신입 공채 AI 리터러시 역량 평가',
      category: '정규 평가 (Python / Java / C++)',
      duration: '90분',
      questions: '총 4문제',
      status: 'AVAILABLE',
      date: '2026.07.20 ~ 2026.07.22',
      guide: '신분증 인증 및 스마트폰(보조 카메라) 연동 필수',
    }
  ];

  // [연습문제 탭] 데이터
  const practiceList = [
    {
      id: 1,
      title: '[모의 테스트] 실시간 AI 감독 및 사전 장비 점검 체험',
      category: '환경 점검 및 WebRTC 통신 테스트',
      duration: '30분',
      level: '초급',
      desc: '실제 시험 응시 전에 웹캠, 화면 공유, QR 모바일 연동이 잘 되는지 미리 연습해보세요.',
    }
  ];

  // 공지사항 및 FAQ 데이터
  const notices = [
    { id: 1, title: '[필수 독려] 시험 응시 전 PC 크롬(Chrome) 브라우저 최신 업데이트 안내', date: '2026.07.18', important: true },
    { id: 2, title: '보조 카메라(스마트폰) 거치 각도 및 QR 연결 가이드라인', date: '2026.07.15', important: true }
  ];
  const faqs = [
    { q: 'Q. 휴대폰 보조 카메라는 어떻게 거치해야 하나요?', a: 'A. 응시자의 측면 45도 각도에서 PC 모니터 화면과 응시자의 얼굴, 손이 모두 화면에 들어오도록 거치해야 합니다.' },
    { q: 'Q. 듀얼 모니터를 사용해도 되나요?', a: 'A. 불가능합니다. 사전 장비 점검 시 듀얼 모니터가 감지되면 시험 입장이 제한됩니다.' }
  ];

  // 🌟 핵심 기능 클릭 시 비회원 처리를 위한 통합 인터셉터 함수
  const handleProtectedAction = (actionRoute) => {
    if (userRole === 'GUEST') {
      const confirmLogin = window.confirm('🔒 이 기능은 로그인이 필요합니다.\n로그인/회원가입 페이지로 이동하시겠습니까?');
      if (confirmLogin) {
        navigate('/login');
      }
    } else {
      navigate(actionRoute);
    }
  };

  // 로그아웃 처리 함수
  const handleLogout = () => {
    localStorage.clear();
    alert('로그아웃되었습니다.');
    navigate('/login');
  };

  return (
    <div className="layout-sidebar-container">
      {/* =========================================================
          [좌측 영역] 사이드바 네비게이션 (비회원이라도 무조건 노출)
          ========================================================= */}
      <aside className="sidebar">
        <div className="sidebar-user-box">
          <div className="user-avatar">
            <User size={24} color="#2563EB" />
          </div>
          <div className="user-info">
            <div className="user-name">
              {userRole === 'APPLICANT' && '응시자 계정'}
              {userRole === 'ADMIN' && '관리자 계정'}
              {userRole === 'GUEST' && '게스트 상태'}
            </div>
            <div className="user-email">{userEmail}</div>
          </div>
        </div>

        <div className="sidebar-menu-label">메뉴 네비게이션</div>

        <nav className="sidebar-nav">
          <button className={`sidebar-menu-item ${activeTab === 'EXAM' ? 'active' : ''}`} onClick={() => setActiveTab('EXAM')}>
            <CheckCircle2 size={18} /><span>평가 (정규 시험)</span>
            <ChevronRight size={16} className="arrow-icon" />
          </button>

          <button className={`sidebar-menu-item ${activeTab === 'CHECK' ? 'active' : ''}`} onClick={() => setActiveTab('CHECK')}>
            <Shield size={18} /><span>시험 전 점검</span>
            <ChevronRight size={16} className="arrow-icon" />
          </button>

          <button className={`sidebar-menu-item ${activeTab === 'PRACTICE' ? 'active' : ''}`} onClick={() => setActiveTab('PRACTICE')}>
            <BookOpen size={18} /><span>연습문제</span>
            <ChevronRight size={16} className="arrow-icon" />
          </button>

          <button className={`sidebar-menu-item ${activeTab === 'NOTICE' ? 'active' : ''}`} onClick={() => setActiveTab('NOTICE')}>
            <Bell size={18} /><span>공지사항</span>
            <ChevronRight size={16} className="arrow-icon" />
          </button>

          <button className={`sidebar-menu-item ${activeTab === 'FAQ' ? 'active' : ''}`} onClick={() => setActiveTab('FAQ')}>
            <HelpCircle size={18} /><span>자주 묻는 질문</span>
            <ChevronRight size={16} className="arrow-icon" />
          </button>
        </nav>

        {/* 🌟 사이드바 최하단: 회원상태에 따라 로그아웃 또는 로그인 버튼 스위칭 */}
        <div className="sidebar-footer">
          {userRole !== 'GUEST' ? (
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={16} />
              <span>로그아웃</span>
            </button>
          ) : (
            <button className="logout-btn" style={{color: '#2563EB'}} onClick={() => navigate('/login')}>
              <LogIn size={16} />
              <span>로그인하러 가기</span>
            </button>
          )}
        </div>
      </aside>

      {/* =========================================================
          [우측 메인 영역] 컨텐츠 제어
          ========================================================= */}
      <main className="main-content-area">

        {/* 관리자가 아닐 때 (일반 회원 및 게스트 회원) */}
        {userRole !== 'ADMIN' && (
          <>
            <div className="content-header-bar">
              <div>
                <h1 className="content-main-title">
                  {activeTab === 'EXAM' && '평가 목록'}
                  {activeTab === 'CHECK' && '사전 환경 점검 안내'}
                  {activeTab === 'PRACTICE' && '연습문제 목록'}
                  {activeTab === 'NOTICE' && '공지사항'}
                  {activeTab === 'FAQ' && '자주 묻는 질문 (FAQ)'}
                </h1>
                {userRole === 'GUEST' && (
                  <span className="badge-status alert-error" style={{display: 'inline-block', marginBottom: '0.5rem'}}>
                    ⚠️ 비회원 상태입니다. 상세 기능 진입 시 로그인이 요구됩니다.
                  </span>
                )}
              </div>
            </div>

            {/* --- 1. [평가 탭] --- */}
            {activeTab === 'EXAM' && (
              <div className="cards-grid">
                {examList.map((exam) => (
                  <div key={exam.id} className="prog-card">
                    <div className="prog-card-top">
                      <span className="prog-category">{exam.category}</span>
                      <span className="badge-status badge-available">응시 가능</span>
                    </div>
                    <h2 className="prog-title">{exam.title}</h2>
                    <div className="prog-info-list">
                      <div className="prog-info-item"><Clock size={16} color="#64748b" /><span>제한 시간: {exam.duration}</span></div>
                      <div className="prog-info-item"><Award size={16} color="#64748b" /><span>문항 수: {exam.questions}</span></div>
                    </div>
                    <div className="prog-card-footer">
                      <span className="prog-date">{exam.date}</span>
                      {/* 🌟 로그인 가드 연결 */}
                      <button className="prog-action-btn btn-blue" onClick={() => handleProtectedAction('/exam/check')}>
                        <span>시험 입장</span><ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* --- 2. [시험 전 점검 탭] --- */}
            {activeTab === 'CHECK' && (
              <div className="card" style={{padding: '2rem', textAlign: 'center'}}>
                <h2 className="card-title">사전 장비 점검 연동 테스트</h2>
                <p className="text-muted" style={{marginBottom: '1.5rem'}}>실제 코딩 테스트 시작 전 웹캠 및 화면 공유 상태를 점검하는 기능입니다.</p>
                <button className="btn-primary" style={{margin: '0 auto'}} onClick={() => handleProtectedAction('/exam/check')}>
                  <span>점검 카메라 구동하기</span><ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* --- 3. [연습문제 탭] --- */}
            {activeTab === 'PRACTICE' && (
              <div className="cards-grid">
                {practiceList.map((practice) => (
                  <div key={practice.id} className="prog-card">
                    <div className="prog-card-top">
                      <span className="prog-category">{practice.category}</span>
                    </div>
                    <h2 className="prog-title">{practice.title}</h2>
                    <p className="text-muted" style={{fontSize: '0.9rem', flex: 1}}>{practice.desc}</p>
                    <div className="prog-card-footer">
                      <div className="prog-info-item"><Clock size={16} color="#64748b" /><span>{practice.duration}</span></div>
                      {/* 🌟 로그인 가드 연결 */}
                      <button className="prog-action-btn btn-outline-blue" onClick={() => handleProtectedAction('/exam/check')}>
                        <span>모의 연습 시작</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* --- 4. [공지사항 탭] (비회원도 조회 가능) --- */}
            {activeTab === 'NOTICE' && (
              <div className="card" style={{padding: 0}}>
                {notices.map((n) => (
                  <div key={n.id} className="notice-row" onClick={() => alert(`[공지] ${n.title}`)}>
                    <span style={{color: '#1e293b'}}>{n.title}</span>
                    <span className="text-muted" style={{fontSize: '0.85rem'}}>{n.date}</span>
                  </div>
                ))}
              </div>
            )}

            {/* --- 5. [FAQ 탭] (비회원도 조회 가능) --- */}
            {activeTab === 'FAQ' && (
              <div className="card" style={{padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                {faqs.map((f, idx) => (
                  <div key={idx} style={{padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1'}}>
                    <div style={{fontWeight: 'bold', color: '#0f172a', marginBottom: '0.5rem'}}>{f.q}</div>
                    <div style={{color: '#475569', fontSize: '0.9rem'}}>{f.a}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* [관리자 모드] */}
        {userRole === 'ADMIN' && (
          <div className="cards-grid">
            <div className="card admin-card" onClick={() => navigate('/admin/dashboard')}>
              <h3>실시간 AI 감독 대시보드</h3>
              <span className="admin-link">대시보드 입장 &rarr;</span>
            </div>
            <div className="card admin-card" onClick={() => navigate('/admin/report')}>
              <h3>AI 역량 평가 리포트 조회</h3>
              <span className="admin-link">리포트 조회 &rarr;</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}