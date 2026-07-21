import React from 'react';
import { PlusSquare, PlusCircle } from 'lucide-react';

export default function ExamCreateTab() {
  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '10px', color: '#2563EB' }}>
          <PlusSquare size={24} />
        </div>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>시험 생성 관리</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>새로운 역량 평가 세션을 등록하고 일정을 설정합니다.</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <div className="input-group">
          <label className="input-label">시험 명칭</label>
          <input type="text" placeholder="예: 2026년 하반기 신입 공채 AI 리터러시 역량 평가" className="form-input" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">제한 시간</label>
            <input type="text" placeholder="90분" className="form-input" />
          </div>
          <div className="input-group">
            <label className="input-label">문항 수</label>
            <input type="text" placeholder="총 4문제" className="form-input" />
          </div>
        </div>
        <button className="btn-primary" onClick={() => alert('시험이 등록되었습니다.')} style={{ marginTop: '1rem', width: 'fit-content' }}>
          <PlusCircle size={16} style={{ marginRight: '6px' }} /> 시험 등록하기
        </button>
      </div>
    </div>
  );
}