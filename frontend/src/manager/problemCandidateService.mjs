export async function generateProblemCandidates(examId, requirements, onProgress = () => {}, signal) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`${baseUrl}/manager/exams/${examId}/ai-problem-candidates?stream=1`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ requirements }), signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `AI 요청에 실패했습니다. (HTTP ${response.status})`);
  }
  if (!response.body) throw new Error("생성 진행 상태를 받을 수 없습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result;
  const handleEvent = (event) => {
    if (event.type === "progress") onProgress(event.step);
    if (event.type === "result") result = event;
    if (event.type === "error") {
      const failure = new Error(event.message);
      failure.aiFailure = event;
      throw failure;
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line));
    if (done) { if (buffer.trim()) handleEvent(JSON.parse(buffer)); break; }
  }
  if (!result?.candidates) throw new Error("AI 에이전트가 결과를 반환하지 못했습니다.");
  return result;
}
