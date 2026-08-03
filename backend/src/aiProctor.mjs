const EVENT_TYPES = new Set(["NO_PERSON", "MULTIPLE_PEOPLE", "CELL_PHONE_DETECTED", "BOOK_DETECTED"]);
const DEFAULT_MESSAGES = {
  NO_PERSON: "화면에서 응시자가 반복 감지되지 않았습니다.",
  MULTIPLE_PEOPLE: "화면에서 여러 사람이 반복 감지되었습니다.",
  CELL_PHONE_DETECTED: "화면에서 휴대전화가 반복 감지되었습니다.",
  BOOK_DETECTED: "화면에서 책으로 추정되는 물체가 반복 감지되었습니다."
};

const numberInRange = (value, minimum, maximum) => typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const normalizeAiResult = (payload, { bookDetectionEnabled = false } = {}) => {
  if (!payload || typeof payload !== "object") throw new Error("AI proctor returned an invalid response");
  const detections = Array.isArray(payload.detections) ? payload.detections.slice(0, 50).flatMap((detection) => {
    const label = typeof detection?.label === "string" ? detection.label.trim().slice(0, 80) : "";
    const bbox = Array.isArray(detection?.bbox) ? detection.bbox : [];
    if (!label || !numberInRange(detection?.confidence, 0, 1) || bbox.length !== 4 || !bbox.every((value) => numberInRange(value, 0, 1))) return [];
    if (bbox[0] > bbox[2] || bbox[1] > bbox[3]) return [];
    return [{ label, confidence: detection.confidence, bbox }];
  }) : [];
  const strongestEvents = new Map();
  for (const event of Array.isArray(payload.events) ? payload.events.slice(0, 50) : []) {
    if (!EVENT_TYPES.has(event?.type) || (event.type === "BOOK_DETECTED" && !bookDetectionEnabled)) continue;
    const confidence = event.type === "NO_PERSON" ? 1 : event.confidence;
    if (!numberInRange(confidence, 0, 1)) continue;
    const normalized = { type: event.type, confidence, message: typeof event.message === "string" ? event.message.trim().slice(0, 300) : "" };
    if (!strongestEvents.has(event.type) || strongestEvents.get(event.type).confidence < confidence) strongestEvents.set(event.type, normalized);
  }
  return {
    model: typeof payload.model === "string" ? payload.model.trim().slice(0, 120) : "unknown",
    latencyMs: Math.max(0, Math.min(300000, Number(payload.latencyMs) || 0)),
    personCount: Math.max(0, Math.min(100, Math.trunc(Number(payload.personCount) || 0))),
    detections,
    events: [...strongestEvents.values()]
  };
};

export const createAiProctor = ({
  endpoint = process.env.AI_PROCTOR_URL,
  apiKey = process.env.AI_PROCTOR_API_KEY,
  confidence = positiveNumber(process.env.AI_PROCTOR_CONFIDENCE, 0.55),
  consecutiveHits = positiveNumber(process.env.AI_PROCTOR_CONSECUTIVE_HITS, 2),
  cooldownSeconds = positiveNumber(process.env.AI_PROCTOR_WARNING_COOLDOWN_SECONDS, 60),
  bookDetectionEnabled = String(process.env.AI_PROCTOR_BOOK_DETECTION_ENABLED).toLowerCase() === "true",
  timeoutMs = 8000,
  stateTtlMs = 10 * 60 * 1000,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  onResult = async () => {},
  onWarning = async () => {},
  logger = console
} = {}) => {
  const baseUrl = typeof endpoint === "string" ? endpoint.trim().replace(/\/$/, "") : "";
  const active = new Map();
  const eventStates = new Map();
  const tasks = new Set();
  let stopping = false;

  const updateEventStates = async (job, result) => {
    const timestamp = now();
    const present = new Map(result.events.map((event) => [event.type, event]));
    for (const type of EVENT_TYPES) {
      const stateKey = `${job.examId}:${job.candidateId}:${type}`;
      const state = eventStates.get(stateKey) ?? { consecutiveHits: 0, lastSeenAt: timestamp, lastWarningAt: 0 };
      const event = present.get(type);
      state.lastSeenAt = timestamp;
      if (!event || event.confidence < confidence) state.consecutiveHits = 0;
      else {
        state.consecutiveHits += 1;
        if (state.consecutiveHits >= Math.max(1, Math.trunc(consecutiveHits)) && timestamp - state.lastWarningAt >= cooldownSeconds * 1000) {
          state.lastWarningAt = timestamp;
          state.consecutiveHits = 0;
          await onWarning(job, { ...event, message: DEFAULT_MESSAGES[type] });
        }
      }
      eventStates.set(stateKey, state);
    }
    for (const [key, state] of eventStates) if (timestamp - state.lastSeenAt > stateTtlMs) eventStates.delete(key);
  };

  const detect = async (job) => {
    const headers = { "Content-Type": "application/json" };
    if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
    const response = await fetchImpl(`${baseUrl}/detect`, {
      method: "POST", headers, body: JSON.stringify({ image: job.image, examId: job.examId, candidateId: job.candidateId }), signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`AI proctor request failed (${response.status})`);
    return normalizeAiResult(await response.json(), { bookDetectionEnabled });
  };

  const run = async (key, firstJob) => {
    let job = firstJob;
    while (job && !stopping) {
      try {
        const result = await detect(job);
        await onResult(job, { ...result, analyzedAt: new Date(now()).toISOString() });
        await updateEventStates(job, result);
      } catch (error) {
        logger.warn?.("AI proctor analysis failed", error instanceof Error ? error.message : error);
      }
      const slot = active.get(key);
      job = slot?.pending ?? null;
      if (slot) slot.pending = null;
    }
    active.delete(key);
  };

  const schedule = (job) => {
    if (stopping || !baseUrl || !job?.image || !job.examId || !job.candidateId) return false;
    const key = `${job.examId}:${job.candidateId}`;
    const slot = active.get(key);
    if (slot) {
      slot.pending = job;
      return true;
    }
    const nextSlot = { pending: null };
    active.set(key, nextSlot);
    const task = run(key, job).finally(() => tasks.delete(task));
    tasks.add(task);
    return true;
  };

  const shutdown = async ({ graceMs = 5000 } = {}) => {
    stopping = true;
    for (const slot of active.values()) slot.pending = null;
    await Promise.race([Promise.allSettled([...tasks]), new Promise((resolve) => setTimeout(resolve, graceMs))]);
  };

  return { enabled: Boolean(baseUrl), schedule, shutdown, get activeCount() { return active.size; } };
};

