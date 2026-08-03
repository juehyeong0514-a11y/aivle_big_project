const EVENT_LABELS = {
  NO_PERSON: "응시자 미감지",
  MULTIPLE_PEOPLE: "여러 사람 감지",
  CELL_PHONE_DETECTED: "휴대전화 감지",
  BOOK_DETECTED: "책 감지"
};
const DETECTION_LABELS = { person: "사람", "cell phone": "휴대전화", book: "책" };

export const warningSourceLabel = (source) => ({ AI: "AI", SUPERVISOR: "감독자", SYSTEM: "시스템" })[source] ?? "기록";
export const aiEventLabel = (type) => EVENT_LABELS[type] ?? "알 수 없는 이벤트";
export const aiDetectionLabel = (label) => DETECTION_LABELS[label] ?? label;

export const normalizeAiMonitoring = (snapshot) => {
  const ai = snapshot?.ai;
  if (!ai || typeof ai !== "object") return null;
  const analyzedAt = typeof ai.analyzedAt === "string" && !Number.isNaN(Date.parse(ai.analyzedAt)) ? ai.analyzedAt : null;
  const events = Array.isArray(ai.events) ? ai.events.flatMap((event) => EVENT_LABELS[event?.type] && typeof event.confidence === "number" && event.confidence >= 0 && event.confidence <= 1 ? [{ type: event.type, confidence: event.confidence, label: EVENT_LABELS[event.type] }] : []).slice(0, 4) : [];
  const detections = Array.isArray(ai.detections) ? ai.detections.flatMap((detection, index) => {
    const bbox = detection?.bbox;
    const validBox = Array.isArray(bbox) && bbox.length === 4 && bbox.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) && bbox[0] < bbox[2] && bbox[1] < bbox[3];
    if (!validBox || typeof detection.label !== "string" || typeof detection.confidence !== "number" || detection.confidence < 0 || detection.confidence > 1) return [];
    return [{ id: `${detection.label}-${index}`, label: detection.label, displayLabel: aiDetectionLabel(detection.label), confidence: detection.confidence, bbox }];
  }).slice(0, 50) : [];
  return {
    analyzedAt,
    model: typeof ai.model === "string" && ai.model.trim() ? ai.model.trim().slice(0, 120) : "모델 정보 없음",
    personCount: Number.isInteger(ai.personCount) && ai.personCount >= 0 ? ai.personCount : null,
    events,
    detections
  };
};
