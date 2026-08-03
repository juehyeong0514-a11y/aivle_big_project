import assert from 'node:assert/strict';
import test from 'node:test';
import { aiDetectionLabel, aiEventLabel, normalizeAiMonitoring, warningSourceLabel } from './aiMonitoring.mjs';

test('labels warning sources and AI events', () => {
  assert.equal(warningSourceLabel('AI'), 'AI');
  assert.equal(warningSourceLabel('SUPERVISOR'), '감독자');
  assert.equal(aiEventLabel('CELL_PHONE_DETECTED'), '휴대전화 감지');
  assert.equal(aiDetectionLabel('person'), '사람');
});

test('normalizes missing and partially invalid AI data safely', () => {
  assert.equal(normalizeAiMonitoring({ image: 'data:image/jpeg;base64,x' }), null);
  const value = normalizeAiMonitoring({ ai: { model: 'test', personCount: 1, analyzedAt: '2026-08-03T00:00:00.000Z', events: [{ type: 'NO_PERSON', confidence: 1 }, { type: 'UNKNOWN', confidence: 1 }], detections: [{ label: 'person', confidence: .91, bbox: [.1, .2, .6, .9] }, { label: 'bad', confidence: .5, bbox: [1, 0, 0, 1] }] } });
  assert.equal(value.model, 'test');
  assert.equal(value.events.length, 1);
  assert.equal(value.detections.length, 1);
  assert.deepEqual(value.detections[0].bbox, [.1, .2, .6, .9]);
});
