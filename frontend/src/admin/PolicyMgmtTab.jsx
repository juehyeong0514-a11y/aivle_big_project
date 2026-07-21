import React from 'react';
import { FileText } from 'lucide-react';

export default function PolicyMgmtTab() {
  return (
    <div className="card" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '10px', color: '#16a34a' }}>
          <FileText size={24} />
        </div>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>문제 및 정책 관리</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>코딩 테스트 문제 세트 등록 및 컴파일러 허용 정책을 구성합니다.</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>문제 #1: LLM 기반 코드 리팩토링 및 성능 검증</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>배점: 25점 | 언어 제한: Python3, Java17</p>
        </div>
        <button className="btn-secondary" style={{ width: 'fit-content' }} onClick={() => alert('신규 문제 출제 모달 오픈')}>
          + 신규 문제 추가
        </button>
      </div>
    </div>
  );
}