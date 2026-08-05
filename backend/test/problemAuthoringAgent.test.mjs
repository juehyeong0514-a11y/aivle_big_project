import assert from "node:assert/strict";
import test from "node:test";
import { runProblemAuthoringAgent } from "../src/problemAuthoringAgent.mjs";

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
