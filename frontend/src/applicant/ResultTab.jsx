import React from 'react';
import { Award, CheckCircle2, AlertTriangle, FileText, Download, BarChart3, Code } from 'lucide-react';

export default function ResultTab() {
  // 예시 시험 결과 데이터
  const examResult = {
    title: '2026년 하반기 신입 공채 AI 리터러시 역량 평가',
    submittedAt: '2026.07.20 14:30:00',
    totalScore: '85 / 100',
    passStatus: '합격 (정규 전형 진입)',
    problems: [
      { id: 1, name: 'LLM 기반 코드 리팩토링 및 성능 검증', score: '25/25', status: '정답' },
      { id: 2, name: '비동기 데이터 스트림 처리 최적화', score: '20/25', status: '부분 정답' },
      { id: 3, name: '지능형 이상 행동 감지 필터 구현', score: '25/25', status: '정답' },
      { id: 4, name: '대규모 로그 데이터 시멘틱 검색', score: '15/25', status: '부분 정답' },
    ],
    aiSupervisionSummary: {
      eyeTracking: '정상 (이탈률 1.2% 미만)',
      deviceCheck: '통과 (웹캠 및 보조 카메라 정상 유지)',
      violations: 0, // 감지된 부정행위 횟수
    },
    llmFeedback: '전체적인 알고리즘 설계와 시멘틱 코드 구조가 매우 우수합니다. 문제 2번과 4번에서 메모리 효율성(Time/Space Complexity) 측면을 조금 더 고려한다면 완벽한 코드가 될 것입니다.'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. 상단 결과 요약 배너 */}
      <div className="card" style={{ padding: '2.5rem', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '0.75rem', fontWeight: '600' }}>
              <Award size={20} />
              <span>역량 평가 결과 리포트</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'white'}}>{examResult.title}</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>제출 일시: {examResult.submittedAt}</p>
          </div>
          <div style={{ textAlign: 'right', backgroundColor: 'rgba(255,255,255,0.08)', padding: '1.25rem 1.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>최종 획득 점수</div>
            <div style={{ fontSize: '2.25rem', fontWeight: '900', color: '#4ade80' }}>{examResult.totalScore}</div>
            <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 'bold', marginTop: '4px' }}>{examResult.passStatus}</div>
          </div>
        </div>
      </div>

      {/* 2. 문제별 채점 상세 내역 */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Code size={22} color="#2563EB" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>문제별 자동 채점 결과</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {examResult.problems.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: p.status === '정답' ? '#dcfce7' : '#fef9c3', color: p.status === '정답' ? '#16a34a' : '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {p.id}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>판정 상태: <span style={{ fontWeight: '600', color: p.status === '정답' ? '#16a34a' : '#d97706' }}>{p.status}</span></div>
                </div>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>
                {p.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. AI 감독 보안 분석 및 LLM 피드백 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* AI 화상 감독 요약 */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <BarChart3 size={20} color="#16a34a" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>실시간 AI 감독 보안 리포트</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>시선 및 자세 추적</span>
              <span style={{ fontWeight: '600', color: '#16a34a' }}>{examResult.aiSupervisionSummary.eyeTracking}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>장비 및 보조카메라 상태</span>
              <span style={{ fontWeight: '600', color: '#16a34a' }}>{examResult.aiSupervisionSummary.deviceCheck}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0' }}>
              <span style={{ color: '#64748b' }}>부정행위 감지 횟수</span>
              <span style={{ fontWeight: '600', color: '#2563EB' }}>{examResult.aiSupervisionSummary.violations}회 (특이사항 없음)</span>
            </div>
          </div>
        </div>

        {/* LLM 코드 리뷰 총평 */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <FileText size={20} color="#7c3aed" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>AI LLM 코드 리뷰 총평</h3>
          </div>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', margin: 0 }}>
            "{examResult.llmFeedback}"
          </p>
        </div>
      </div>

      {/* 하단 다운로드 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button className="btn-secondary" onClick={() => alert('성적 증명서 PDF 다운로드가 시작됩니다.')}>
          <Download size={16} style={{ marginRight: '6px' }} /> 성적 증명서 다운로드
        </button>
      </div>
    </div>
  );
}