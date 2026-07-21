import React from 'react';
import { Cpu, Settings } from 'lucide-react';

export default function AiConfigTab() {
  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#f5f3ff', borderRadius: '10px', color: '#7c3aed' }}>
          <Cpu size={24} />
        </div>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>LLM 및 AI 분석 설정</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>코드 자동 채점을 위한 LLM 파이프라인 및 화상 감시 모델 민감도를 조절합니다.</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>
        <div className="input-group">
          <label className="input-label">코드 자동 채점 LLM 모델 선택</label>
          <select className="form-input">
            <option>GPT-4o (고성능 시멘틱 코드 리뷰)</option>
            <option>Claude 3.5 Sonnet (엄격한 문법 및 효율성 검증)</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">웹캠 AI 감독 민감도 (Threshold)</label>
          <input type="range" min="1" max="100" defaultValue="75" className="form-input" style={{ padding: 0 }} />
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>현재 설정값: 75% (정밀 감지 모드)</span>
        </div>
        <button className="btn-primary" style={{ width: 'fit-content', marginTop: '1rem' }} onClick={() => alert('AI 분석 설정이 반영되었습니다.')}>
          <Settings size={16} style={{ marginRight: '6px' }} /> 설정 적용
        </button>
      </div>
    </div>
  );
}