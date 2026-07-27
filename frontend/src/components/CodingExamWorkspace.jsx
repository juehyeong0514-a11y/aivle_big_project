import React, { useEffect, useState } from 'react';
import { Clock, Play, Send } from 'lucide-react';

const resultTabs = [
  { id: 'run', label: '실행 결과' },
  { id: 'tests', label: '테스트 케이스' },
  { id: 'submission', label: '제출 결과' },
];

function sourceFileName(language) {
  if (language === 'Java') return 'Main.java';
  if (language === 'JavaScript') return 'solution.js';
  return 'solution.py';
}

export function CodingExamWorkspace({ answers, exam, questions, submissionError, updateAnswers }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeResultTab, setActiveResultTab] = useState('run');
  const [runNotice, setRunNotice] = useState('코드를 작성한 뒤 실행을 눌러 공개 예제를 확인하세요.');
  const question = questions[activeIndex] ?? questions[0];
  const languages = question.languages?.length ? question.languages : ['Python'];
  const answer = answers[question.id] ?? {};
  const language = answer.language ?? languages[0];
  const source = answer.source ?? '';
  const sourceLines = Math.max(source.split('\n').length, 16);

  useEffect(() => {
    if (submissionError) setActiveResultTab('submission');
  }, [submissionError]);

  const updateAnswer = (nextAnswer) => {
    updateAnswers({
      ...answers,
      [question.id]: { language, source, ...nextAnswer },
    });
  };

  const showRunNotice = () => {
    setActiveResultTab('run');
    setRunNotice('실행 서버가 아직 연결되지 않았습니다. 공개 예제와 제출 결과는 채점 서버 연결 후 제공됩니다.');
  };

  return (
    <main className="coding-session-shell">
      <div className="coding-session-form">
        <header className="coding-session-header">
          <div className="coding-session-brand">
            <strong>{exam.title}</strong>
            <span>코딩 테스트</span>
          </div>
        </header>

        <div className="coding-session-workspace">
          <aside className="coding-navigation-pane" aria-label="문제 선택">
            <div className="coding-problem-toolbar">
              <span><Clock size={16} /> 남은 시간 <strong>{exam.duration}</strong></span>
            </div>
            <nav className="coding-problem-list" aria-label="문제 선택">
              {questions.map((codingQuestion, index) => (
                <button
                  aria-current={activeIndex === index ? 'true' : undefined}
                  className={activeIndex === index ? 'active' : ''}
                  key={codingQuestion.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                >
                  <span>{index + 1}.</span> {codingQuestion.title}
                </button>
              ))}
            </nav>
          </aside>

          <aside className="coding-problem-pane" aria-label="문제 설명">
            <div className="coding-problem-heading">
              <span>문제 {activeIndex + 1}</span>
              <h1>{question.title}</h1>
            </div>
            <StatementSection title="문제 설명" value={question.description || question.prompt} />
            <StatementSection title="입력" value={question.inputFormat} />
            <StatementSection title="출력" value={question.outputFormat} />
            {question.constraints && <StatementSection title="제한" value={question.constraints} />}
            {question.publicExamples?.length > 0 && (
              <section className="coding-statement-section">
                <h2>입출력 예시</h2>
                <div className="coding-example-list">
                  {question.publicExamples.map((example, index) => (
                    <article className="coding-example" key={`${question.id}-${index}`}>
                      <strong>예제 {index + 1}</strong>
                      <ExampleValue label="입력" value={example.input} />
                      <ExampleValue label="출력" value={example.expectedOutput} />
                      {example.explanation && <p>{example.explanation}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </aside>

          <section className="coding-editor-pane" aria-label="코드 작성 및 결과">
            <div className="coding-editor-workspace">
              <div className="coding-editor-toolbar">
                <strong>{sourceFileName(language)}</strong>
                <label>
                  <span className="sr-only">프로그래밍 언어</span>
                  <select value={language} onChange={(event) => updateAnswer({ language: event.target.value })}>
                    {languages.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <div className="coding-editor-body">
                <ol className="coding-line-numbers" aria-hidden="true">
                  {Array.from({ length: sourceLines }, (_, index) => <li key={index}>{index + 1}</li>)}
                </ol>
                <textarea
                  aria-label="답안 코드"
                  className="coding-source-editor"
                  placeholder="여기에 코드를 작성하세요."
                  spellCheck="false"
                  value={source}
                  onChange={(event) => updateAnswer({ source: event.target.value })}
                />
              </div>
            </div>

            <section className="coding-result-panel" aria-label="실행 및 제출 결과">
              <div className="coding-result-tabs" role="tablist" aria-label="결과 탭">
                {resultTabs.map((tab) => (
                  <button
                    aria-selected={activeResultTab === tab.id}
                    className={activeResultTab === tab.id ? 'active' : ''}
                    id={`result-tab-${tab.id}`}
                    key={tab.id}
                    role="tab"
                    type="button"
                    onClick={() => setActiveResultTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="coding-result-content" role="tabpanel" aria-labelledby={`result-tab-${activeResultTab}`}>
                {activeResultTab === 'run' && <p>{runNotice}</p>}
                {activeResultTab === 'tests' && <PublicTestCases examples={question.publicExamples} />}
                {activeResultTab === 'submission' && <p>{submissionError || '제출 전입니다. 제출하면 채점 상태가 이곳에 표시됩니다.'}</p>}
              </div>
              <footer className="coding-result-controls">
                <span><Clock size={15} /> 남은 시간 <strong>{exam.duration}</strong></span>
                <div>
                  <button className="coding-run-button" type="button" onClick={showRunNotice}><Play size={15} /> 실행</button>
                  <button className="coding-submit-button" type="submit"><Send size={15} /> 코드 저장하고 제출</button>
                </div>
              </footer>
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatementSection({ title, value }) {
  return <section className="coding-statement-section"><h2>{title}</h2><p>{value || `${title} 형식이 등록되지 않았습니다.`}</p></section>;
}

function ExampleValue({ label, value }) {
  return <div><span>{label}</span><pre>{value}</pre></div>;
}

function PublicTestCases({ examples }) {
  if (!examples?.length) return <p>등록된 공개 예제가 없습니다.</p>;
  return <div className="coding-result-test-list">{examples.map((example, index) => <div key={`${index}-${example.input}`}><strong>예제 {index + 1}</strong><span>입력: {example.input}</span><span>기대 출력: {example.expectedOutput}</span></div>)}</div>;
}
