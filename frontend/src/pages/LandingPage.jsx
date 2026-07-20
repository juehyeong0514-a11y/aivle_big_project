import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Monitor, Code2, Cpu, CheckCircle2, Lock, Eye } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      {/* 상단 네비게이션 */}
      <nav className="navbar">
          {/* 🌟 로고 영역 클릭 시 첫 화면('/')으로 이동 */}
          <div className="logo-area" onClick={() => navigate('/')}>
            <div className="logo-icon">
              <ShieldCheck color="#ffffff" size={24} />
            </div>
            <span className="logo-title">AI 리터러시 역량 테스트</span>
          </div>

          <div className="nav-right">
            <button className="nav-link-btn" onClick={() => alert('이용 안내 페이지 준비중입니다.')}>이용 안내</button>
            <button className="nav-link-btn" onClick={() => alert('단체/기업 도입 문의 준비중입니다.')}>도입 문의</button>
            <button className="nav-action-btn" onClick={() => navigate('/login')}>로그인 / 회원가입</button>
          </div>
      </nav>

      {/* 메인 히어로 섹션 */}
      <section className="hero-section">
        {/* 좌측 타이틀 및 버튼 영역 */}
        <div className="hero-left">
          <div className="hero-badge">
            <Cpu size={16} color="#2563EB" />
            <span>차세대 AI 기반 IT 역량 검증 플랫폼</span>
          </div>

          <h1 className="main-title">
            AI 리터러시<br />
            <span className="text-primary">역량 테스트</span> 플랫폼
          </h1>

          <p className="sub-description">
            실시간 지능형 감시 시스템과 자동 채점 파이프라인으로<br />
            공정하고 신뢰할 수 있는 개발자 역량 평가를 지금 경험해보세요.
          </p>

          <div className="button-group">
            <button className="btn-primary" onClick={() => navigate('/login')}>
              <span>테스트 응시 및 시작하기</span>
              <ArrowRight size={18} />
            </button>
            <button className="btn-secondary" onClick={() => alert('이용 안내 및 가이드를 확인합니다.')}>
              이용 안내 보기
            </button>
          </div>

          <div className="feature-list">
            <div className="feature-item">
              <CheckCircle2 size={18} color="#16a34a" />
              <span>WebRTC 다중 카메라 실시간 감독</span>
            </div>
            <div className="feature-item">
              <CheckCircle2 size={18} color="#16a34a" />
              <span>LLM 기반 코드 품질 자동 분석</span>
            </div>
          </div>
        </div>

        {/* 우측 모니터 UI 그래픽 영역 */}
        <div className="hero-right">
          <div className="graphic-container">
            <div className="bg-circle bg-circle-1"></div>
            <div className="bg-circle bg-circle-2"></div>

            <div className="mockup-window">
              <div className="window-header">
                <div className="dot-group">
                  <span className="dot dot-red"></span>
                  <span className="dot dot-yellow"></span>
                  <span className="dot dot-green"></span>
                </div>
                <span className="window-title">Live AI Supervision & Coding</span>
              </div>

              <div className="window-body">
                <div className="code-area">
                  <div className="code-line">
                    <Code2 size={16} color="#3b82f6" />
                    <span style={{color: '#38bdf8', fontWeight: 'bold'}}>function</span>
                    <span style={{color: '#f8fafc'}}>evaluateAiLiteracy() &#123;</span>
                  </div>
                  <div className="code-line code-indent text-muted">// Humaneval 기반 AI 코딩 테스트 진행중...</div>
                  <div className="code-line code-indent text-purple">const status = "AI_MONITORING_ACTIVE";</div>
                  <div className="code-line code-indent text-green">return analyzeCodeQuality();</div>
                  <div className="code-line" style={{color: '#f8fafc'}}>&#125;</div>
                </div>

                <div className="status-cards-row">
                  <div className="mini-card">
                    <Eye size={20} color="#3b82f6" />
                    <div>
                      <div className="mini-title">시선 추적 정상</div>
                      <div className="mini-sub">WebRTC 1080p 송출중</div>
                    </div>
                  </div>
                  <div className="mini-card">
                    <Lock size={20} color="#10b981" />
                    <div>
                      <div className="mini-title">보안 환경 감지</div>
                      <div className="mini-sub">화면 이탈 차단 작동중</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-badge">
              <div className="floating-icon">
                <Monitor size={24} color="#ffffff" />
              </div>
              <div>
                <div style={{fontWeight: 'bold', fontSize: '0.85rem', color: '#0f172a'}}>실시간 AI 분석</div>
                <div style={{fontSize: '0.75rem', color: '#64748b'}}>이상 행동 0건 탐지됨</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}