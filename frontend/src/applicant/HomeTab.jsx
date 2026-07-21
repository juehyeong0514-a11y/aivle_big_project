import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, ArrowRight, CheckCircle2, Code2, Eye, Lock, Monitor } from 'lucide-react';

export default function HomeTab() {
  const navigate = useNavigate();

  return (
    <section className="hero-section" style={{ display: 'flex', alignItems: 'center', gap: '3rem', padding: '1rem 0', flexWrap: 'wrap' }}>
      <div className="hero-left" style={{ flex: '1 1 500px' }}>
        <div className="hero-badge" style={{ marginBottom: '1.5rem' }}>
          <Cpu size={16} color="#2563EB" style={{ marginRight: '6px' }} />
          <span>🚀 KT AIVLE School 9기 빅프로젝트 23조</span>
        </div>

        <h1 className="main-title" style={{ fontSize: '3rem', fontWeight: '900', lineHeight: '1.2', marginBottom: '1.5rem' }}>
          AI 리터러시<br />
          <span className="text-primary">역량 테스트</span> 플랫폼
        </h1>

        <p className="sub-description" style={{ color: '#475569', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
          실시간 지능형 감시 시스템과 자동 채점 파이프라인으로<br />
          공정하고 신뢰할 수 있는 개발자 역량 평가를 제공합니다.
        </p>

        <div className="button-group" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn-primary" onClick={() => navigate('/home?tab=EXAM')}>
            <span>테스트 응시하기</span>
            <ArrowRight size={18} />
          </button>
          <button className="btn-secondary" onClick={() => navigate('/home?tab=CHECK')}>
            장비 점검하기
          </button>
        </div>

        <div className="feature-list" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="feature-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#334155' }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span>WebRTC 삼중 카메라 실시간 감독</span>
          </div>
          <div className="feature-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: '#334155' }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span>지능형 이상행동 및 객체/이어폰 감지</span>
          </div>
        </div>
      </div>

      <div className="hero-right" style={{ flex: '1 1 450px', position: 'relative' }}>
        <div className="graphic-container">
          <div className="mockup-window">
            <div className="window-header" style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#1e293b' }}>
              <div className="dot-group" style={{ display: 'flex', gap: '6px' }}>
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>
              <span className="window-title" style={{ marginLeft: '12px', color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>Live AI Supervision & Coding</span>
            </div>

            <div className="window-body" style={{ padding: '1.5rem', backgroundColor: '#0f172a' }}>
              <div className="code-area" style={{ fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.7', backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', color: '#f8fafc' }}>
                <div className="code-line" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code2 size={16} color="#3b82f6" />
                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>function</span>
                  <span>evaluateAiLiteracy() &#123;</span>
                </div>
                <div className="code-line text-muted" style={{ paddingLeft: '1.5rem', color: '#64748b' }}>// AI 화상 감독 시스템 실시간 작동중</div>
                <div className="code-line text-purple" style={{ paddingLeft: '1.5rem', color: '#a78bfa' }}>const status = "AI_MONITORING_ACTIVE";</div>
                <div className="code-line text-green" style={{ paddingLeft: '1.5rem', color: '#4ade80' }}>return analyzeCodeQuality();</div>
                <div>&#125;</div>
              </div>

              <div className="status-cards-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                <div className="mini-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155' }}>
                  <Eye size={20} color="#3b82f6" />
                  <div>
                    <div className="mini-title" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f8fafc' }}>시선 추적 상태</div>
                    <div className="mini-sub" style={{ fontSize: '0.7rem', color: '#4ade80' }}>정상 (화면 응시)</div>
                  </div>
                </div>
                <div className="mini-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155' }}>
                  <Lock size={20} color="#10b981" />
                  <div>
                    <div className="mini-title" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f8fafc' }}>주변 환경 보안</div>
                    <div className="mini-sub" style={{ fontSize: '0.7rem', color: '#94a3b8' }}>외부 음성/기기 차단</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="floating-badge" style={{ position: 'absolute', bottom: '-15px', right: '10px', backgroundColor: '#ffffff', padding: '0.75rem 1rem', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 2 }}>
            <div className="floating-icon" style={{ padding: '0.5rem', backgroundColor: '#2563EB', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <Monitor size={24} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#0f172a' }}>실시간 AI 웹캠 분석</div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold' }}>이상 행동 미감지</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}