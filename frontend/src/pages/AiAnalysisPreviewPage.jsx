import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const previewProblems = [
  {
    title: '중복 제거 (오름차순 정렬)',
    score: 30,
    algorithmScore: 20,
    codeQualityScore: 10,
    time: 'O(N log N) · 기준 O(N log N)',
    timeAnalysis: 'set으로 중복을 제거하고 sorted로 정렬하므로 평균적으로 O(N log N) 시간 복잡도를 가집니다.',
    space: 'O(N) · 기준 O(N)',
    spaceAnalysis: '중복 제거 결과를 저장하는 자료구조가 입력 크기에 비례하는 공간을 사용합니다.',
    feedback: '중복 제거와 오름차순 정렬을 정확히 구현했습니다. 출력 형식도 요구사항과 일치합니다.',
  },
  {
    title: '중복 제거 후 합 구하기',
    score: 27,
    algorithmScore: 18,
    codeQualityScore: 9,
    time: 'O(N) · 기준 O(N)',
    timeAnalysis: '입력 전체를 한 번 순회하며 Set을 구성하고 합계를 계산해 선형 시간에 처리합니다.',
    space: 'O(N) · 기준 O(N)',
    spaceAnalysis: '중복되지 않은 값을 Set에 보관하므로 최악의 경우 입력 크기만큼 공간이 필요합니다.',
    feedback: '핵심 로직은 정확합니다. 변수 이름을 조금 더 구체적으로 작성하면 의도를 더 빠르게 파악할 수 있습니다.',
  },
  {
    title: '가장 많이 등장한 숫자 찾기',
    score: 24,
    algorithmScore: 16,
    codeQualityScore: 8,
    time: 'O(N) · 기준 O(N)',
    timeAnalysis: '빈도표를 생성하는 과정과 최댓값을 찾는 과정이 각각 선형 시간에 수행됩니다.',
    space: 'O(N) · 기준 O(N)',
    spaceAnalysis: '서로 다른 숫자의 빈도를 저장하기 위한 해시 자료구조를 사용합니다.',
    feedback: '정답은 도출했지만 동률 처리 조건이 명확하지 않습니다. 문제의 우선순위 조건을 코드에 직접 반영해 주세요.',
  },
  {
    title: '연속 부분 수열의 최대 합',
    score: 21,
    algorithmScore: 14,
    codeQualityScore: 7,
    time: 'O(N²) · 기준 O(N)',
    timeAnalysis: '모든 시작점에서 부분합을 다시 계산해 이중 반복이 발생합니다. 누적 최댓값을 갱신하는 방식으로 개선할 수 있습니다.',
    space: 'O(1) · 기준 O(1)',
    spaceAnalysis: '추가 배열 없이 현재 합과 최대 합만 유지해 상수 공간을 사용합니다.',
    feedback: '결과는 맞지만 입력이 커지면 제한 시간을 초과할 수 있습니다. Kadane 알고리즘으로 시간 복잡도를 개선해 주세요.',
  },
];

export default function AiAnalysisPreviewPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const problem = previewProblems[activeIndex];

  const moveProblem = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= previewProblems.length) return;
    setActiveIndex(nextIndex);
  };

  return <main className="ai-analysis-preview-page">
    <div className="ai-analysis-preview-heading">
      <span className="workspace-eyebrow">UI PREVIEW</span>
      <h1>AI 분석 결과 탐색 시안</h1>
      <p>상단 종합 분석은 유지하고 문제별 결과만 같은 자리에서 전환합니다.</p>
    </div>

    <section className="ai-analysis-result ai-analysis-paged" aria-labelledby="preview-ai-analysis-title">
      <div className="ai-analysis-summary">
        <div className="ai-analysis-summary-copy">
          <span className="ai-analysis-kicker">AI REVIEW</span>
          <h3 id="preview-ai-analysis-title">AI 분석 자료</h3>
          <p>전체 문제의 핵심 로직은 정확하지만 일부 문제에서 효율성과 조건 처리 개선이 필요합니다. 문제별 분석을 확인해 보세요.</p>
        </div>
        <div className="ai-analysis-total-score"><span>총점</span><strong>102</strong><small>/ 120점</small></div>
      </div>

      <div className="ai-analysis-problem-nav">
        <div className="ai-analysis-problem-tabs" role="tablist" aria-label="문제별 AI 분석">
          {previewProblems.map((item, index) => <button
            aria-controls="preview-ai-problem-panel"
            aria-selected={activeIndex === index}
            className={activeIndex === index ? 'active' : ''}
            id={`preview-ai-problem-tab-${index}`}
            key={item.title}
            onClick={() => setActiveIndex(index)}
            role="tab"
            type="button"
          ><span className="ai-analysis-problem-tab-label">문제 {index + 1}</span><strong className="ai-analysis-problem-tab-score">{item.score}점</strong></button>)}
        </div>
        <span className="ai-analysis-problem-position">{activeIndex + 1} / {previewProblems.length}</span>
      </div>

      <article aria-labelledby={`preview-ai-problem-tab-${activeIndex}`} className="ai-analysis-selected-problem" id="preview-ai-problem-panel" role="tabpanel">
        <div className="ai-analysis-question-heading">
          <div><small>문제 {activeIndex + 1}</small><strong>{problem.title}</strong></div>
          <span>{problem.score} / 30점</span>
        </div>

        <div className="ai-analysis-selected-grid">
          <section className="ai-analysis-part score-part">
            <h4><span>01</span> 채점 항목</h4>
            <div className="ai-analysis-score-grid">
              <ResultMetric label="알고리즘 정확성" value={`${problem.algorithmScore} / 20`} />
              <ResultMetric label="코드 품질" value={`${problem.codeQualityScore} / 10`} />
            </div>
          </section>
          <section className="ai-analysis-part complexity-part">
            <h4><span>02</span> 효율성 분석</h4>
            <div className="ai-analysis-complexity-grid">
              <ComplexityMetric analysis={problem.timeAnalysis} label="시간 복잡도" value={problem.time} />
              <ComplexityMetric analysis={problem.spaceAnalysis} label="공간 복잡도" value={problem.space} />
            </div>
          </section>
        </div>

        <section className="ai-analysis-part feedback-part">
          <h4><span>03</span> 종합 피드백</h4>
          <div className="ai-analysis-feedback"><p>{problem.feedback}</p></div>
        </section>

        <div className="ai-analysis-problem-actions">
          <button className="secondary-button" disabled={activeIndex === 0} onClick={() => moveProblem(activeIndex - 1)} type="button"><ChevronLeft size={16} /> 이전 문제</button>
          <span>문제 {activeIndex + 1} / 총 {previewProblems.length}문제</span>
          <button className="primary-button" disabled={activeIndex === previewProblems.length - 1} onClick={() => moveProblem(activeIndex + 1)} type="button">다음 문제 <ChevronRight size={16} /></button>
        </div>
      </article>
    </section>
  </main>;
}

function ResultMetric({ label, value }) {
  return <div className="result-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function ComplexityMetric({ analysis, label, value }) {
  return <div className="ai-complexity-analysis"><strong>{label}</strong><span>{value}</span><p>{analysis}</p></div>;
}
