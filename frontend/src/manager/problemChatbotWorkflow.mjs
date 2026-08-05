const text = (value) => String(value ?? "").trim();

export const REQUIREMENT_OPTIONS = {
  difficulty: ["초급", "중급", "고급"],
  type: ["CODING", "MULTIPLE_CHOICE"],
};
export const CODING_LANGUAGE_OPTIONS = ["Python", "Java", "C", "JavaScript"];

export function validateRequirements(requirements) {
  const errors = {};
  ["difficulty", "type", "scope"].forEach((field) => {
    if (!text(requirements?.[field])) errors[field] = "이 항목을 선택하거나 입력해 주세요.";
  });
  if (text(requirements?.scope).length === 1) errors.scope = "출제 범위는 두 글자 이상 입력해 주세요.";
  if (requirements?.type === "CODING" && (!Array.isArray(requirements.languages) || requirements.languages.length === 0)) errors.languages = "사용 언어를 하나 이상 선택해 주세요.";
  return errors;
}

const styles = [
  { id: "sum", label: "실습형", summary: "여러 값을 처리하는 기본 구현 문제" },
  { id: "count", label: "개념 확인형", summary: "조건을 판별하고 개수를 세는 문제" },
  { id: "maximum", label: "도전형", summary: "값과 위치를 함께 추적하는 문제" },
];

export function generateCandidates(requirements) {
  return styles.map((style, index) => ({
    ...style,
    seed: index + 1,
    requirements: { ...requirements },
    revisionNotes: [],
  }));
}

export function refineCandidate(candidate, feedback) {
  const note = text(feedback);
  if (!note) return { error: "수정할 내용을 입력해 주세요." };
  const requirements = { ...candidate.requirements };
  if (/쉽|기초|초급/.test(note)) requirements.difficulty = "초급";
  if (/어렵|심화|고급/.test(note)) requirements.difficulty = "고급";
  return { candidate: { ...candidate, requirements, revisionNotes: [...candidate.revisionNotes, note] }, error: "" };
}

export function candidateToProblem(candidate) {
  if (candidate?.form && candidate?.requirements?.type) return { type: candidate.requirements.type, form: candidate.form };
  const { requirements } = candidate;
  if (requirements.type === "MULTIPLE_CHOICE") return multipleChoiceProblem(candidate);
  return codingProblem(candidate);
}

function codingProblem(candidate) {
  const { requirements, revisionNotes } = candidate;
  const revision = revisionNotes.length ? `\n\n반영한 수정 사항: ${revisionNotes.join(" / ")}` : "";
  const shared = {
    languages: ["Python"],
    constraints: "1 ≤ N ≤ 100,000\n각 정수의 절댓값은 1,000,000 이하입니다.",
    judgeMode: "EXACT",
  };
  const problems = {
    sum: {
      title: `${requirements.scope} - 정수 합계`,
      description: "정수 N개가 주어집니다. 모든 정수의 합을 출력하세요.",
      inputFormat: "첫째 줄에 정수의 개수 N이 주어집니다.\n둘째 줄에 N개의 정수가 공백으로 구분되어 주어집니다.",
      outputFormat: "N개 정수의 합을 출력합니다.",
      publicExamples: [{ input: "5\n1 2 3 4 5", expectedOutput: "15", explanation: "1부터 5까지의 합은 15입니다." }],
      hiddenTestCases: [{ input: "3\n-4 10 2", expectedOutput: "8" }, { input: "1\n0", expectedOutput: "0" }],
    },
    count: {
      title: `${requirements.scope} - 짝수 개수 세기`,
      description: "정수 N개가 주어집니다. 이 중 짝수인 정수의 개수를 출력하세요.",
      inputFormat: "첫째 줄에 정수의 개수 N이 주어집니다.\n둘째 줄에 N개의 정수가 공백으로 구분되어 주어집니다.",
      outputFormat: "주어진 정수 중 짝수의 개수를 출력합니다.",
      publicExamples: [{ input: "5\n1 2 3 4 5", expectedOutput: "2", explanation: "2와 4, 두 개의 짝수가 있습니다." }],
      hiddenTestCases: [{ input: "4\n-2 0 7 10", expectedOutput: "3" }, { input: "3\n1 3 5", expectedOutput: "0" }],
    },
    maximum: {
      title: `${requirements.scope} - 최댓값과 위치 찾기`,
      description: "정수 N개가 주어질 때, 가장 큰 수와 그 수가 처음 등장한 위치를 출력하세요. 위치는 1부터 시작합니다.",
      inputFormat: "첫째 줄에 정수의 개수 N이 주어집니다.\n둘째 줄에 N개의 정수가 공백으로 구분되어 주어집니다.",
      outputFormat: "첫째 줄에 최댓값을, 둘째 줄에 최댓값이 처음 등장한 위치를 출력합니다.",
      publicExamples: [{ input: "5\n3 9 2 9 1", expectedOutput: "9\n2", explanation: "최댓값 9는 두 번째 위치에 처음 등장합니다." }],
      hiddenTestCases: [{ input: "1\n-4", expectedOutput: "-4\n1" }, { input: "4\n0 0 0 0", expectedOutput: "0\n1" }],
    },
  };
  const selected = problems[candidate.id];
  return {
    type: "CODING",
    form: {
      ...shared,
      ...selected,
      description: `${selected.description}\n\n출제 의도: ‘${requirements.scope}’ 범위를 활용하는 ${requirements.difficulty} ${candidate.label} 문제입니다.${revision}`,
    },
  };
}

function multipleChoiceProblem(candidate) {
  const { requirements, revisionNotes } = candidate;
  const note = revisionNotes.length ? `\n수정 요청: ${revisionNotes.join(" / ")}` : "";
  const options = ["핵심 조건을 모두 만족하는 설명", "일부 조건만 만족하는 설명", "문제와 관련 없는 설명", "핵심 조건과 반대되는 설명"];
  return { type: "MULTIPLE_CHOICE", form: { prompt: `[${requirements.difficulty}] ${requirements.scope}에 관한 가장 적절한 설명을 고르세요.${note}`, options, answer: options[0] } };
}
