import React, { useState } from 'react';
import { FileText, Award, CheckCircle2, AlertTriangle, Code, BarChart3, Search, ChevronRight } from 'lucide-react';

export default function ReportsTab() {
  // 예시 응시자 리포트 데이터 리스트
  const [examineeReports, setExamineeReports] = useState([
    {
      id: 1,
      name: '김응시',
      email: 'applicant1@aivle.com',
      submitTime: '2026.07.20 14:30:00',
      totalScore: '85 / 100',
      passStatus: '합격 (정규 전형 진입)',
      problems: [
        { id: 1, name: 'LLM 기반 코드 리팩토링 및 성능 검증', score: '25/25', status: '정답' },
        { id: 2, name: '비동기 데이터 스트림 처리 최적화', score: '20/25', status: '부분 정답' },
        { id: 3, name: '지능형 이상 행동 감지 필터 구현', score: '25/25', status: '정답' },
        { id: 4, name: '대규모 로그 데이터 시멘틱 검색', score: '15/25', status: '부분 정답' },
      ],
      aiSupervision: { eyeTracking: '정상 (이탈률 1.2% 미만)', deviceCheck: '통과', violations: 0 },
      llmFeedback: '전체적인 알고리즘 설계와 시멘틱 코드 구조가 매우 우수합니다. 문제 2번과 4번에서 메모리 효율성을 조금 더 고려하면 완벽합니다.'
    },
    {
      id: 2,
      name: '이수험',
      email: 'applicant2@aivle.com',
      submitTime: '2026.07.20 14:28:15',
      totalScore: '70 / 100',
      passStatus: '보류 (감독관 검토 필요)',
      problems: [
        { id: 1, name: 'LLM 기반 코드 리팩토링 및 성능 검증', score: '20/25', status: '부분 정답' },
        { id: 2, name: '비동기 데이터 스트림 처리 최적화', score: '15/25', status: '부분 정답' },
        { id: 3, name: '지능형 이상 행동 감지 필터 구현', score: '20/25', status: '부분 정답' },
        { id: 4, name: '대규모 로그 데이터 시멘틱 검색', score: '15/25', status: '부분 정답' },
      ],
      aiSupervision: { eyeTracking: '주의 (시선 이탈 2회 감지)', deviceCheck: '통과', violations: 2 },
      llmFeedback: '기본적인 기능 구현은 완료되었으나 예외 처리 로직이 일부 누락되어 있습니다. AI 화상 감독 중 시선 이탈 로그가 2회 발생하여 추가 검토가 권장됩니다.'
    },
    {
      id: 3,
      name: '박개발',
      email: 'applicant3@aivle.com',
      submitTime: '2026.07.20 14:32:40',
      totalScore: '95 / 100',
      passStatus: '최우수 합격',
      problems: [
        { id: 1, name: 'LLM 기반 코드 리팩토링 및 성능 검증', score: '25/25', status: '정답' },
        { id: 2, name: '비동기 데이터 스트림 처리 최적화', score: '25/25', status: '정답' },
        { id: 3, name: '지능형 이상 행동 감지 필터 구현', score: '25/25', status: '정답' },
        { id: 4, name: '대규모 로그 데이터 시멘틱 검색', score: '20/25', status: '부분 정답' },
      ],
      aiSupervision: { eyeTracking: '완벽 (이탈률 0%)', deviceCheck: '통과', violations: 0 },
      llmFeedback: '매우 뛰어난 코드 최적화 능력을 보여주었습니다. 특히 비동기 처리 구조가 탁월합니다.'
    }
  ]);

  // 현재 상세 조회 중인 응시자 (선택되지 않았으면 null)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 검색 필터링
  const filteredList = examineeReports.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* 상단 헤더 배너 */}
      <div className="card" style={{ padding: '2rem', backgroundColor: '#1e293b', color: '#ffffff', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
          <FileText size={24} color="#38bdf8" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: 'white' }}>응시자 AI 역량 평가 리포트 검토</h2>
        </div>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
          AI가 자동 채점한 코딩 테스트 결과와 실시간 화상 감독 보안 로그를 감독관 권한으로 최종 검토하고 승인할 수 있습니다.
        </p>
      </div>

      {selectedStudent ? (
        /* ================= 🔍 [상세 리포트 보기 모드] ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <button
            onClick={() => setSelectedStudent(null)}
            className="btn-secondary"
            style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ← 목록으로 돌아가기
          </button>

          {/* 응시자 요약 카드 */}
          <div className="card" style={{ padding: '2rem', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>응시자 상세 정보</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 2px 0' }}>{selectedStudent.name} ({selectedStudent.email})</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>제출 완료 일시: {selectedStudent.submitTime}</p>
              </div>
              <div style={{ textAlign: 'right', backgroundColor: '#f8fafc', padding: '1rem 1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>최종 점수 / 판정</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#2563EB' }}>{selectedStudent.totalScore}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#16a34a', marginTop: '2px' }}>{selectedStudent.passStatus}</div>
              </div>
            </div>

            {/* 문제별 채점 결과 */}
            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={18} color="#2563EB" /> 문제별 자동 채점 세부 내역
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {selectedStudent.problems.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: p.status === '정답' ? '#dcfce7' : '#fef9c3', color: p.status === '정답' ? '#16a34a' : '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {p.id}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.95rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>상태: <span style={{ fontWeight: '600', color: p.status === '정답' ? '#16a34a' : '#d97706' }}>{p.status}</span></div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>{p.score}</div>
                </div>
              ))}
            </div>

            {/* AI 감독 및 LLM 리뷰 요약 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h5 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={16} color="#16a34a" /> 화상 감독 보안 요약
                </h5>
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px', color: '#475569' }}>
                  <div>시선 추적: <strong>{selectedStudent.aiSupervision.eyeTracking}</strong></div>
                  <div>장비 점검: <strong>{selectedStudent.aiSupervision.deviceCheck}</strong></div>
                  <div>부정행위 감지: <strong style={{ color: selectedStudent.aiSupervision.violations > 0 ? '#dc2626' : '#16a34a' }}>{selectedStudent.aiSupervision.violations}회</strong></div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h5 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="#7c3aed" /> LLM 코드 리뷰 총평
                </h5>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                  "{selectedStudent.llmFeedback}"
                </p>
              </div>
            </div>

            {/* 감독관 승인 액션 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => alert(`[${selectedStudent.name}] 응시자의 리포트에 '보류/추가 검토' 의견이 저장되었습니다.`)}
                className="btn-secondary"
                style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde047' }}
              >
                ⚠️ 추가 검토 필요 처리
              </button>
              <button
                onClick={() => alert(`[${selectedStudent.name}] 응시자의 최종 합격 및 리포트가 공식 승인되었습니다.`)}
                className="btn-primary"
                style={{ backgroundColor: '#16a34a' }}
              >
                ✅ 최종 리포트 승인
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= 📋 [응시자 리포트 목록 모드] ================= */
        <div className="card" style={{ padding: '2rem' }}>
          {/* 검색 바 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>응시자별 AI 평가 리포트 목록</h3>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                placeholder="응시자 이름 또는 이메일 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.25rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {/* 리스트 테이블 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem' }}>응시자 성명</th>
                  <th style={{ padding: '0.75rem' }}>이메일</th>
                  <th style={{ padding: '0.75rem' }}>제출 일시</th>
                  <th style={{ padding: '0.75rem' }}>총점</th>
                  <th style={{ padding: '0.75rem' }}>AI 판정 상태</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>리포트 상세</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((st) => (
                  <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: 'bold', color: '#0f172a' }}>{st.name}</td>
                    <td style={{ padding: '1rem 0.75rem', color: '#64748b' }}>{st.email}</td>
                    <td style={{ padding: '1rem 0.75rem', color: '#64748b', fontSize: '0.85rem' }}>{st.submitTime}</td>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: 'bold', color: '#2563EB' }}>{st.totalScore}</td>
                    <td style={{ padding: '1rem 0.75rem' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                        backgroundColor: st.passStatus.includes('합격') ? '#dcfce7' : '#fef3c7',
                        color: st.passStatus.includes('합격') ? '#16a34a' : '#d97706'
                      }}>
                        {st.passStatus}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedStudent(st)}
                        style={{ padding: '0.4rem 0.8rem', backgroundColor: '#eff6ff', color: '#2563EB', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        리포트 열기 <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}