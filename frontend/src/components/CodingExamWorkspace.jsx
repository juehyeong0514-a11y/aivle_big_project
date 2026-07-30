import React, { useEffect, useRef, useState } from 'react';
import { Clock, Play, Save, Send } from 'lucide-react';

const resultTabs = [
  { id: 'run', label: '실행 결과' },
  { id: 'tests', label: '테스트 케이스' },
  { id: 'submission', label: '제출 결과' },
];

const initialJavaScriptSource = `const message = 'Hello, JavaScript!';
console.log(message);

const numbers = [1, 2, 3, 4, 5];
const total = numbers.reduce((sum, number) => sum + number, 0);
console.log('합계:', total);`;

function sourceFileName(language) {
  if (language === 'Java') return 'Main.java';
  if (language === 'JavaScript') return 'solution.js';
  return 'solution.py';
}

function runJavaScript(source) {
  const workerSource = `
    const format = (value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.stack || value.message;
      try {
        const serialized = JSON.stringify(value);
        return serialized === undefined ? String(value) : serialized;
      } catch {
        return String(value);
      }
    };
    self.onmessage = async ({ data }) => {
      const output = [];
      const console = {
        log: (...values) => output.push(values.map(format).join(' ')),
        warn: (...values) => output.push(values.map(format).join(' ')),
        error: (...values) => output.push(values.map(format).join(' ')),
      };
      try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const execute = new AsyncFunction('console', '"use strict";\\n' + data.source);
        const result = await execute(console);
        if (result !== undefined) output.push(format(result));
        self.postMessage({ type: 'success', output: output.join('\\n') || '출력이 없습니다.' });
      } catch (error) {
        self.postMessage({ type: 'error', output: format(error) });
      }
    };
  `;

  return new Promise((resolve) => {
    const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    let finished = false;
    const timeout = window.setTimeout(() => finish({ type: 'error', output: '실행 시간이 3초를 초과했습니다.' }), 3000);
    const finish = (result) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve(result);
    };
    worker.onmessage = ({ data }) => finish(data);
    worker.onerror = () => finish({ type: 'error', output: '코드를 실행하지 못했습니다.' });
    worker.postMessage({ source });
  });
}

export function CodingExamWorkspace({ answers, exam, questions, remainingTime, runResults, saveProgress, saveStatus, submissionError, updateAnswers, updateRunResults }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeResultTab, setActiveResultTab] = useState('run');
  const [panelSizes, setPanelSizes] = useState({ navigation: 18, statement: 27, editor: 66 });
  const workspaceRef = useRef(null);
  const editorPaneRef = useRef(null);
  const lineNumberRef = useRef(null);
  const question = questions[activeIndex] ?? questions[0];
  const isCodingQuestion = question.type === 'CODING';
  const configuredLanguages = question.languages?.length ? question.languages : ['Python'];
  const languages = [...new Set([...configuredLanguages, 'JavaScript'])];
  const answer = answers[question.id] ?? {};
  const language = answer.language ?? 'JavaScript';
  const source = answer.source ?? question.starterCode ?? initialJavaScriptSource;
  const sourceLines = Math.max(source.split('\n').length, 16);
  const runResult = runResults[question.id] ?? { type: 'notice', output: '코드를 작성한 뒤 실행을 눌러 결과를 확인하세요.' };

  useEffect(() => {
    if (submissionError) setActiveResultTab('submission');
  }, [submissionError]);

  const updateAnswer = (nextAnswer) => {
    updateAnswers({
      ...answers,
      [question.id]: { language, source, ...nextAnswer },
    });
  };

  const runCode = async () => {
    setActiveResultTab('run');
    if (language.toLowerCase() !== 'javascript') {
      updateRunResults({ ...runResults, [question.id]: { type: 'error', output: `${language} 실행은 채점 서버 연결 후 제공됩니다. 현재는 JavaScript만 브라우저에서 실행할 수 있습니다.`, executedAt: new Date().toISOString() } });
      return;
    }
    if (!source.trim()) {
      updateRunResults({ ...runResults, [question.id]: { type: 'error', output: '실행할 JavaScript 코드를 입력해 주세요.', executedAt: new Date().toISOString() } });
      return;
    }
    updateRunResults({ ...runResults, [question.id]: { type: 'running', output: '실행 중...', executedAt: new Date().toISOString() } });
    const result = await runJavaScript(source);
    updateRunResults({ ...runResults, [question.id]: { ...result, executedAt: new Date().toISOString() } });
  };

  const resizePanel = (panel, startEvent) => {
    const container = panel === 'editor' ? editorPaneRef.current : workspaceRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startSizes = panelSizes;
    const startPosition = panel === 'editor' ? startEvent.clientY : startEvent.clientX;
    const totalSize = panel === 'editor' ? rect.height : rect.width;

    const resize = (event) => {
      const offset = ((panel === 'editor' ? event.clientY : event.clientX) - startPosition) / totalSize * 100;
      setPanelSizes(() => {
        if (panel === 'navigation') {
          const navigation = Math.min(30, Math.max(15, startSizes.navigation + offset));
          return { ...startSizes, navigation };
        }
        if (panel === 'statement') {
          const statement = Math.min(100 - startSizes.navigation - 35, Math.max(20, startSizes.statement + offset));
          return { ...startSizes, statement };
        }
        return { ...startSizes, editor: Math.min(80, Math.max(35, startSizes.editor + offset)) };
      });
    };

    const stopResize = () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stopResize);
    };

    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stopResize, { once: true });
  };

  const adjustPanelWithKeyboard = (panel, event) => {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 2 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -2 : 0;
    if (!direction) return;
    event.preventDefault();
    setPanelSizes((current) => {
      if (panel === 'navigation') return { ...current, navigation: Math.min(30, Math.max(15, current.navigation + direction)) };
      if (panel === 'statement') return { ...current, statement: Math.min(100 - current.navigation - 35, Math.max(20, current.statement + direction)) };
      return { ...current, editor: Math.min(80, Math.max(35, current.editor + direction)) };
    });
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

        <div
          className="coding-session-workspace"
          ref={workspaceRef}
          style={{ '--navigation-width': `${panelSizes.navigation}%`, '--statement-width': `${panelSizes.statement}%` }}
        >
          <aside className="coding-navigation-pane" aria-label="문제 선택">
            <div className="coding-problem-toolbar">
              <span><Clock size={16} /> 남은 시간 <strong>{remainingTime}</strong></span>
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
                  <span>{index + 1}.</span> {codingQuestion.title || codingQuestion.prompt}
                </button>
              ))}
            </nav>
          </aside>

          <PanelResizer direction="vertical" label="문제 목록 너비 조절" onKeyDown={(event) => adjustPanelWithKeyboard('navigation', event)} onPointerDown={(event) => resizePanel('navigation', event)} />

          <aside className="coding-problem-pane" aria-label="문제 설명">
            <div className="coding-problem-heading">
              <span>문제 {activeIndex + 1}</span>
              <h1>{question.title || question.prompt}</h1>
            </div>
            <StatementSection title="문제 설명" value={question.description || question.prompt} />
            {isCodingQuestion && <StatementSection title="입력" value={question.inputFormat} />}
            {isCodingQuestion && <StatementSection title="출력" value={question.outputFormat} />}
            {isCodingQuestion && question.constraints && <StatementSection title="제한" value={question.constraints} />}
            {isCodingQuestion && question.publicExamples?.length > 0 && (
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

          <PanelResizer direction="vertical" label="문제 설명 너비 조절" onKeyDown={(event) => adjustPanelWithKeyboard('statement', event)} onPointerDown={(event) => resizePanel('statement', event)} />

          <section className={`coding-editor-pane${isCodingQuestion ? '' : ' objective'}`} aria-label={isCodingQuestion ? '코드 작성 및 결과' : '객관식 답안 작성'} ref={editorPaneRef} style={{ '--editor-height': `${panelSizes.editor}%` }}>
            <div className="coding-editor-workspace">
              <div className="coding-editor-toolbar">
                <strong>{isCodingQuestion ? sourceFileName(language) : '객관식 답안'}</strong>
                {isCodingQuestion && (
                  <label>
                    <span className="sr-only">프로그래밍 언어</span>
                    <select value={language} onChange={(event) => updateAnswer({ language: event.target.value })}>
                      {languages.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {isCodingQuestion ? (
                <div className="coding-editor-body">
                  <ol className="coding-line-numbers" aria-hidden="true" ref={lineNumberRef}>
                    {Array.from({ length: sourceLines }, (_, index) => <li key={index}>{index + 1}</li>)}
                  </ol>
                  <textarea
                    aria-label="답안 코드"
                    className="coding-source-editor"
                    placeholder="여기에 코드를 작성하세요."
                    spellCheck="false"
                    value={source}
                    onChange={(event) => updateAnswer({ source: event.target.value })}
                    onScroll={(event) => { if (lineNumberRef.current) lineNumberRef.current.scrollTop = event.currentTarget.scrollTop; }}
                  />
                </div>
              ) : (
                <fieldset className="coding-objective-body">
                  <legend>정답을 하나 선택하세요.</legend>
                  {(question.options ?? []).map((option, index) => (
                    <label className="coding-objective-option" key={option}>
                      <input
                        checked={answers[question.id] === option}
                        name={`objective-${question.id}`}
                        type="radio"
                        value={option}
                        onChange={(event) => updateAnswers({ ...answers, [question.id]: event.target.value })}
                      />
                      <span>{index + 1}</span>
                      <strong>{option}</strong>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            {isCodingQuestion && <PanelResizer direction="horizontal" label="코드 편집기 높이 조절" onKeyDown={(event) => adjustPanelWithKeyboard('editor', event)} onPointerDown={(event) => resizePanel('editor', event)} />}

            {isCodingQuestion && <section className="coding-result-panel" aria-label="실행 및 제출 결과">
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
                {activeResultTab === 'run' && <pre className={`coding-run-output ${runResult.type}`}>{runResult.output}</pre>}
                {activeResultTab === 'tests' && <PublicTestCases examples={question.publicExamples} />}
                {activeResultTab === 'submission' && <p>{submissionError || '제출 전입니다. 제출하면 채점 상태가 이곳에 표시됩니다.'}</p>}
              </div>
              <footer className="coding-result-controls">
                <div>
                  <button className="coding-run-button" disabled={runResult.type === 'running'} type="button" onClick={runCode}><Play size={15} /> 실행</button>
                  <button className="coding-run-button" type="button" onClick={saveProgress}><Save size={15} /> 코드 저장</button>
                  <button className="coding-submit-button" type="submit"><Send size={15} /> 코드 저장하고 제출</button>
                  {saveStatus && <span className="coding-save-status" role="status">{saveStatus}</span>}
                </div>
              </footer>
            </section>}
            {!isCodingQuestion && (
              <footer className="coding-objective-controls">
                <button className="coding-run-button" type="button" onClick={saveProgress}><Save size={15} /> 답안 저장</button>
                <button className="coding-submit-button" type="submit"><Send size={15} /> 답안 저장하고 제출</button>
                {saveStatus && <span className="coding-save-status" role="status">{saveStatus}</span>}
              </footer>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function PanelResizer({ direction, label, onKeyDown, onPointerDown }) {
  return <div aria-label={label} className={`coding-panel-resizer ${direction}`} onKeyDown={onKeyDown} onPointerDown={onPointerDown} role="separator" tabIndex="0" />;
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
