import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function CheckTab({ onProtectedAction }) {
  return (
    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
      <h2 className="card-title">사전 장비 및 응시 환경 점검 테스트</h2>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>실제 테스트에 참여하기 전 웹캠, 마이크, 화면 공유 연결 상태를 실시간 진단합니다.</p>
      <button className="btn-primary" style={{ margin: '0 auto' }} onClick={() => onProtectedAction('/exam/check')}>
        <span>환경 검사 시스템 구동</span><ArrowRight size={18} />
      </button>
    </div>
  );
}