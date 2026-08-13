export class ProblemAuthoringAgentError extends Error {
  constructor(code, message, { retryable = false, trace = [], cause } = {}) {
    super(message);
    this.name = "ProblemAuthoringAgentError";
    this.code = code;
    this.retryable = retryable;
    this.trace = trace;
    this.cause = cause;
  }
}

const record = (trace, onStep, message) => { trace.push(message); onStep?.(message); };

async function callTool(name, action, trace, onStep) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await action();
      record(trace, onStep, `${name} ${attempt === 1 ? "완료" : "재시도 후 완료"}`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === 1) record(trace, onStep, `${name} 일시 오류로 자동 재시도`);
    }
  }
  throw new ProblemAuthoringAgentError("AI_TOOL_FAILED", `${name}에 실패했습니다.`, { retryable: true, trace, cause: lastError });
}

export async function runProblemAuthoringAgent({ generate, repair, normalizeCandidates, onStep }) {
  const trace = [];
  record(trace, onStep, "요구사항 검증 완료");
  let raw = await callTool("문제 시안 생성", generate, trace, onStep);
  let candidates = normalizeCandidates(raw);
  if (candidates.length !== 3) {
    const issues = ["완성된 시안 3개와 필수 필드가 필요합니다."];
    record(trace, onStep, "서버 형식 검증에서 수정 항목 발견");
    raw = await callTool("수정 시안 생성", () => repair(raw, issues), trace, onStep);
    candidates = normalizeCandidates(raw);
    if (candidates.length !== 3) throw new ProblemAuthoringAgentError("INVALID_REPAIRED_CANDIDATES", "AI가 수정 후에도 등록 가능한 문제 시안 3개를 완성하지 못했습니다. 출제 범위를 조금 더 구체적으로 입력해 다시 시도해주세요.", { retryable: true, trace });
  }

  record(trace, onStep, "서버 형식 검증 완료");
  return { candidates, trace };
}
