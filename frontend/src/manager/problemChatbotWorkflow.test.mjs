import test from "node:test";
import assert from "node:assert/strict";
import { candidateToProblem, generateCandidates, validateRequirements } from "./problemChatbotWorkflow.mjs";
import { validateCodingProblem } from "./codingProblemWorkflow.mjs";

const requirements = {
  difficulty: "중급",
  type: "CODING",
  scope: "배열과 반복문",
  languages: ["Python", "Java"],
  authoringConditions: {
    algorithmRequirements: [{ algorithm: "ARRAY_TRAVERSAL", level: "REQUIRED" }],
    expectedTimeComplexity: "O(N)",
    expectedSpaceComplexity: "O(1)",
    solutionRequirements: "입력을 한 번만 순회",
    prohibitedApproaches: "정렬 사용 금지",
  },
};

test("필수 요구사항을 검사한다", () => {
  assert.ok(validateRequirements({ ...requirements, scope: "" }).scope);
  assert.deepEqual(validateRequirements(requirements), {});
});

test("확정 후보는 세 단계에 필요한 코딩 문제 형식을 모두 갖는다", () => {
  const candidate = generateCandidates(requirements)[0];
  const problem = candidateToProblem(candidate);
  assert.equal(problem.type, "CODING");
  assert.deepEqual(validateCodingProblem(problem.form), {});
  assert.equal(problem.form.hiddenTestCases.length, 2);
  assert.deepEqual(problem.form.aiAnalysis.algorithmRequirements, requirements.authoringConditions.algorithmRequirements);
  assert.equal(problem.form.aiAnalysis.expectedTimeComplexity, "O(N)");
  assert.equal(problem.form.aiAnalysis.prohibitedApproaches, "정렬 사용 금지");
});

test("세부 출제 조건을 비워도 문제 폼을 만들 수 있다", () => {
  const candidate = generateCandidates({ ...requirements, authoringConditions: undefined })[0];
  const problem = candidateToProblem(candidate);
  assert.deepEqual(problem.form.aiAnalysis.algorithmRequirements, []);
  assert.equal(problem.form.aiAnalysis.expectedTimeComplexity, "");
  assert.deepEqual(validateCodingProblem(problem.form), {});
});
