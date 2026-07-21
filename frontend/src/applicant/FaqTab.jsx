import React from 'react';

export default function FaqTab() {
  const faqs = [
    { q: 'Q. 휴대폰 보조 카메라는 어떻게 거치해야 하나요?', a: 'A. 응시자의 측면 45도 각도에서 PC 모니터 화면과 응시자의 얼굴, 손이 모두 화면에 들어오도록 거치해야 합니다.' },
    { q: 'Q. 듀얼 모니터를 사용해도 되나요?', a: 'A. 불가능합니다. 사전 장비 점검 시 듀얼 모니터가 감지되면 시험 입장이 제한됩니다.' }
  ];

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {faqs.map((f, idx) => (
        <div key={idx} style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '0.5rem' }}>{f.q}</div>
          <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>{f.a}</div>
        </div>
      ))}
    </div>
  );
}