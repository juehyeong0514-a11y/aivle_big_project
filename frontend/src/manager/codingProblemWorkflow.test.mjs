import test from "node:test";
import assert from "node:assert/strict";
import { codingDraftKey, getCodingStepStates, hasMeaningfulCodingDraft, parseCodingDraft, serializeCodingDraft, stepForError, validateCodingProblem } from "./codingProblemWorkflow.mjs";

const completeForm = () => ({
  title: "두 수의 합", languages: ["Python"], description: "두 수를 더합니다.", inputFormat: "두 정수", outputFormat: "합", constraints: "1 이상",
  publicExamples: [{ input: "1 2", expectedOutput: "3" }], hiddenTestCases: [{ input: "2 3", expectedOutput: "5" }],
  judgeMode: "EXACT", numericTolerance: 0, customJudgeCode: "", aiAnalysis: { referenceMaterials: [{ name: "guide.md", content: "secret" }] },
});

test("필수 입력과 조건부 채점 값을 검증한다", () => {
  assert.deepEqual(validateCodingProblem(completeForm()), {});
  const form = completeForm();
  form.languages = [];
  form.judgeMode = "CUSTOM";
  assert.ok(validateCodingProblem(form).languages);
  assert.ok(validateCodingProblem(form).customJudgeCode);
  assert.equal(stepForError("customJudgeCode"), 2);
});

test("단계별 완료와 선택 상태를 계산한다", () => {
  assert.deepEqual(getCodingStepStates(completeForm()), ["complete", "complete", "complete", "optional", "complete"]);
  const form = completeForm();
  form.description = "";
  assert.equal(getCodingStepStates(form)[1], "attention");
  assert.equal(getCodingStepStates(form)[4], "attention");
});

test("초안 키를 분리하고 첨부 파일 본문은 저장하지 않는다", () => {
  assert.notEqual(codingDraftKey("exam-1"), codingDraftKey("exam-1", "question-1"));
  const parsed = parseCodingDraft(serializeCodingDraft(completeForm(), "2026-08-04T00:00:00.000Z"));
  assert.equal(parsed.omittedFileCount, 1);
  assert.deepEqual(parsed.form.aiAnalysis.referenceMaterials, []);
  assert.equal(parseCodingDraft("broken"), null);
});

test("공백과 기본값만 있는 초안은 복구 대상으로 보지 않는다", () => {
  const blank = completeForm();
  blank.title = "  ";
  blank.description = "";
  blank.inputFormat = "\n";
  blank.outputFormat = "";
  blank.constraints = "";
  blank.publicExamples = [{ input: " ", expectedOutput: "", explanation: "" }];
  blank.hiddenTestCases = [{ input: "", expectedOutput: "\n" }];
  blank.aiAnalysis.referenceMaterials = [];
  assert.equal(hasMeaningfulCodingDraft(blank), false);
  assert.equal(hasMeaningfulCodingDraft({ ...blank, description: "작성 중인 설명" }), true);
  assert.equal(hasMeaningfulCodingDraft({ ...blank, judgeMode: "IGNORE_WHITESPACE" }), true);
});
