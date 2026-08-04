export const CODING_DRAFT_VERSION = 1;

export const CODING_STEPS = [
  { id: "basics", title: "기본 정보", description: "문제 제목과 사용 언어" },
  { id: "content", title: "문제 내용", description: "설명, 입출력 형식과 제한" },
  { id: "tests", title: "테스트 및 채점", description: "공개 예제, 숨김 테스트와 채점 방식" },
  { id: "ai", title: "AI 분석 설정", description: "선택 사항", optional: true },
  { id: "review", title: "검토 및 등록", description: "누락 확인과 AI 답안" },
];

const text = (value) => String(value ?? "").trim();
const completeCases = (cases) => Array.isArray(cases) && cases.length > 0
  && cases.every((item) => text(item?.input) && text(item?.expectedOutput));

export function validateCodingProblem(form) {
  const errors = {};
  if (!text(form?.title)) errors.title = "문제 제목을 입력해주세요.";
  if (!Array.isArray(form?.languages) || form.languages.length === 0) errors.languages = "사용 언어를 하나 이상 선택해주세요.";
  if (!text(form?.description)) errors.description = "문제 설명을 입력해주세요.";
  if (!text(form?.inputFormat)) errors.inputFormat = "입력 형식을 입력해주세요.";
  if (!text(form?.outputFormat)) errors.outputFormat = "출력 형식을 입력해주세요.";
  if (!text(form?.constraints)) errors.constraints = "제한을 입력해주세요.";
  if (!completeCases(form?.publicExamples)) errors.publicExamples = "모든 공개 예제의 입력과 기대 출력을 입력해주세요.";
  if (!completeCases(form?.hiddenTestCases)) errors.hiddenTestCases = "모든 숨김 테스트의 입력과 기대 출력을 입력해주세요.";
  if (form?.judgeMode === "NUMERIC_TOLERANCE" && (form.numericTolerance === "" || Number(form.numericTolerance) < 0 || Number.isNaN(Number(form.numericTolerance)))) errors.numericTolerance = "0 이상의 허용 오차를 입력해주세요.";
  if (form?.judgeMode === "CUSTOM" && !text(form.customJudgeCode)) errors.customJudgeCode = "별도 채점 코드를 입력해주세요.";
  return errors;
}

export function stepForError(field) {
  if (["title", "languages"].includes(field)) return 0;
  if (["description", "inputFormat", "outputFormat", "constraints"].includes(field)) return 1;
  if (["publicExamples", "hiddenTestCases", "numericTolerance", "customJudgeCode"].includes(field)) return 2;
  return 4;
}

export function getCodingStepStates(form) {
  const errors = validateCodingProblem(form);
  const touched = [
    Boolean(text(form?.title) || form?.languages?.length),
    Boolean(text(form?.description) || text(form?.inputFormat) || text(form?.outputFormat) || text(form?.constraints)),
    Boolean(form?.publicExamples?.some((item) => text(item?.input) || text(item?.expectedOutput)) || form?.hiddenTestCases?.some((item) => text(item?.input) || text(item?.expectedOutput))),
  ];
  const requiredErrors = [
    ["title", "languages"],
    ["description", "inputFormat", "outputFormat", "constraints"],
    ["publicExamples", "hiddenTestCases", "numericTolerance", "customJudgeCode"],
  ];
  const states = requiredErrors.map((fields, index) => {
    const hasError = fields.some((field) => errors[field]);
    if (!hasError) return "complete";
    return touched[index] ? "attention" : "incomplete";
  });
  states.push("optional");
  states.push(Object.keys(errors).length ? "attention" : "complete");
  return states;
}

export function codingDraftKey(examId, editingQuestionId = "") {
  return `coding-problem-draft:v${CODING_DRAFT_VERSION}:${examId}:${editingQuestionId || "new"}`;
}

export function serializeCodingDraft(form, savedAt = new Date().toISOString()) {
  const safeForm = JSON.parse(JSON.stringify(form));
  const omittedFileCount = safeForm.aiAnalysis?.referenceMaterials?.length ?? 0;
  if (safeForm.aiAnalysis) safeForm.aiAnalysis.referenceMaterials = [];
  return JSON.stringify({ version: CODING_DRAFT_VERSION, savedAt, omittedFileCount, form: safeForm });
}

export function parseCodingDraft(value) {
  try {
    const draft = JSON.parse(value);
    if (draft?.version !== CODING_DRAFT_VERSION || !draft.form || typeof draft.form !== "object") return null;
    return draft;
  } catch {
    return null;
  }
}

