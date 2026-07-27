import React from 'react';
import { Mail, ShieldCheck } from 'lucide-react';

export default function ExamTab({ onProtectedAction }) {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div className="check-card-title"><ShieldCheck size={22} color="#2563EB" /><h2>초대받은 시험 입장</h2></div>
      <p className="sub-description">시험 목록은 공개하지 않습니다. 관리자에게 받은 초대 메일의 링크를 통해서만 시험에 입장할 수 있습니다.</p>
      <button className="btn-primary" onClick={() => onProtectedAction('/login')}><Mail size={17} /> 초대 메일을 확인했어요</button>
    </div>
  );
}
