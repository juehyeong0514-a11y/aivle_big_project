import assert from "node:assert/strict";
import test from "node:test";
import { createAiProctor, normalizeAiResult } from "../src/aiProctor.mjs";

const response = (payload) => ({ ok: true, status: 200, json: async () => payload });
const payload = (events = []) => ({ model: "test-yolo", latencyMs: 10, personCount: 1, detections: [], events });
const waitUntil = async (predicate) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("condition was not met");
};

test("normalizes and bounds untrusted AI results", () => {
  const normalized = normalizeAiResult({ model: "model", personCount: 2, detections: [
    { label: "cell phone", confidence: .8, bbox: [.1, .2, .4, .7] },
    { label: "bad", confidence: 2, bbox: [0, 0, 1, 1] }
  ], events: [{ type: "CELL_PHONE_DETECTED", confidence: .8 }, { type: "UNKNOWN", confidence: 1 }] });
  assert.equal(normalized.detections.length, 1);
  assert.deepEqual(normalized.events.map((event) => event.type), ["CELL_PHONE_DETECTED"]);
});

test("requires consecutive hits and enforces cooldown", async () => {
  let clock = 100_000;
  const warnings = [];
  const proctor = createAiProctor({ endpoint: "http://ai", now: () => clock, cooldownSeconds: 60, fetchImpl: async () => response(payload([{ type: "CELL_PHONE_DETECTED", confidence: .9 }])), onWarning: async (_job, event) => warnings.push(event) });
  const job = { image: "data:image/jpeg;base64,x", examId: "exam", candidateId: "candidate", examineeId: "examinee" };
  proctor.schedule(job);
  await waitUntil(() => proctor.activeCount === 0);
  assert.equal(warnings.length, 0);
  proctor.schedule(job);
  await waitUntil(() => proctor.activeCount === 0);
  assert.equal(warnings.length, 1);
  proctor.schedule(job); proctor.schedule(job);
  await waitUntil(() => proctor.activeCount === 0);
  assert.equal(warnings.length, 1);
  clock += 60_001;
  proctor.schedule(job); proctor.schedule(job);
  await waitUntil(() => proctor.activeCount === 0);
  assert.equal(warnings.length, 2);
});

test("keeps webcam and auxiliary-camera warning state separate", async () => {
  const warnings = [];
  const proctor = createAiProctor({
    endpoint: "http://ai",
    fetchImpl: async () => response(payload([{ type: "CELL_PHONE_DETECTED", confidence: .9 }])),
    onWarning: async (job) => warnings.push(job.source)
  });
  const makeJob = (source) => ({ image: "data:image/jpeg;base64,x", examId: "exam", candidateId: "candidate", examineeId: "examinee", source });

  proctor.schedule(makeJob("webcam"));
  await waitUntil(() => proctor.activeCount === 0);
  proctor.schedule(makeJob("auxiliary"));
  await waitUntil(() => proctor.activeCount === 0);
  assert.deepEqual(warnings, []);
  proctor.schedule(makeJob("webcam"));
  await waitUntil(() => proctor.activeCount === 0);

  assert.deepEqual(warnings, ["webcam"]);
});

test("discards warning state when a detection result belongs to a stale snapshot", async () => {
  const warnings = [];
  const proctor = createAiProctor({
    endpoint: "http://ai",
    consecutiveHits: 1,
    fetchImpl: async () => response(payload([{ type: "CELL_PHONE_DETECTED", confidence: .9 }])),
    onResult: async () => false,
    onWarning: async (_job, event) => warnings.push(event)
  });

  proctor.schedule({ image: "data:image/jpeg;base64,x", examId: "exam", candidateId: "candidate", examineeId: "examinee", source: "auxiliary" });
  await waitUntil(() => proctor.activeCount === 0);

  assert.deepEqual(warnings, []);
});

test("coalesces concurrent requests to the newest pending snapshot", async () => {
  const images = [];
  let release;
  const first = new Promise((resolve) => { release = resolve; });
  const proctor = createAiProctor({ endpoint: "http://ai", fetchImpl: async (_url, options) => {
    const image = JSON.parse(options.body).image;
    images.push(image);
    if (images.length === 1) await first;
    return response(payload());
  } });
  const makeJob = (image) => ({ image, examId: "exam", candidateId: "candidate", examineeId: "examinee" });
  proctor.schedule(makeJob("one"));
  proctor.schedule(makeJob("two"));
  proctor.schedule(makeJob("three"));
  release();
  await waitUntil(() => proctor.activeCount === 0);
  assert.deepEqual(images, ["one", "three"]);
});

test("disabled and shutting-down proctors reject new work", async () => {
  assert.equal(createAiProctor({ endpoint: "" }).schedule({ image: "x", examId: "e", candidateId: "c" }), false);
  const proctor = createAiProctor({ endpoint: "http://ai", fetchImpl: async () => response(payload()) });
  await proctor.shutdown();
  assert.equal(proctor.schedule({ image: "x", examId: "e", candidateId: "c" }), false);
});
