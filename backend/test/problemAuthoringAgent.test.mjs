import assert from "node:assert/strict";
import test from "node:test";
import { ProblemAuthoringAgentError, runProblemAuthoringAgent } from "../src/problemAuthoringAgent.mjs";
import { publicAiFailure } from "../src/app.mjs";

test("서버 형식 검증에 실패하면 에이전트가 수정 도구를 호출한다", async () => {
  let repaired = false;
  const result = await runProblemAuthoringAgent({
    generate: async () => ({ version: "draft" }),
    normalizeCandidates: (value) => value.version === "fixed" ? [{}, {}, {}] : [{}],
    repair: async () => { repaired = true; return { version: "fixed" }; },
  });
  assert.equal(repaired, true);
  assert.equal(result.candidates.length, 3);
  assert.ok(result.trace.includes("수정 시안 생성 완료"));
});

test("문제 시안 생성 재시도가 모두 실패하면 마지막 공급자 오류를 보존한다", async () => {
  let attempts = 0;
  const providerError = new Error("The model `missing-model` does not exist");
  providerError.status = 404;
  providerError.code = "model_not_found";

  await assert.rejects(
    runProblemAuthoringAgent({
      generate: async () => { attempts += 1; throw providerError; },
      normalizeCandidates: () => [],
    }),
    (error) => {
      assert.ok(error instanceof ProblemAuthoringAgentError);
      assert.equal(error.cause, providerError);
      assert.equal(error.message, "문제 시안 생성에 실패했습니다.");
      return true;
    },
  );
  assert.equal(attempts, 2);
});

test("공개 AI 오류 정보는 상태와 코드를 유지하고 인증정보를 숨긴다", () => {
  const error = new Error("request failed: https://example.test?key=secret-value Authorization: Bearer sk-secret-token-value");
  error.status = 429;
  error.code = "rate_limit_exceeded";

  const failure = publicAiFailure(error);

  assert.equal(failure.providerStatus, 429);
  assert.equal(failure.providerCode, "rate_limit_exceeded");
  assert.doesNotMatch(failure.detail, /secret-value|secret-token-value/);
});
