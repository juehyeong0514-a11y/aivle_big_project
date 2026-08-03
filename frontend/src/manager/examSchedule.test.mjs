import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExamEndsAt, formatScheduleForApi, parseScheduleForForm, parseScheduleTimestamp } from './examSchedule.mjs';

test('calculates the exam end from the selected start and duration', () => {
  const endsAt = calculateExamEndsAt('2026-08-10T10:00', '60');

  assert.equal(endsAt?.getFullYear(), 2026);
  assert.equal(endsAt?.getMonth(), 7);
  assert.equal(endsAt?.getDate(), 10);
  assert.equal(endsAt?.getHours(), 11);
  assert.equal(endsAt?.getMinutes(), 0);

  const oneMinuteEnd = calculateExamEndsAt('2026-08-10T10:00', '1');
  assert.equal(oneMinuteEnd?.getHours(), 10);
  assert.equal(oneMinuteEnd?.getMinutes(), 1);
});

test('formats the browser picker value for the existing API contract', () => {
  assert.equal(formatScheduleForApi('2026-08-10T10:00'), '2026.08.10 10:00');
});

test('rejects incomplete schedule and duration values', () => {
  assert.equal(calculateExamEndsAt('', '60'), undefined);
  assert.equal(calculateExamEndsAt('2026-08-10T10:00', ''), undefined);
  assert.equal(formatScheduleForApi('2026-08-10'), '');
});

test('parses the API schedule back into editable form fields', () => {
  assert.deepEqual(parseScheduleForForm('2026.08.10 09:05'), {
    date: '2026-08-10',
    hour: '09',
    minute: '05'
  });
});

test('returns sortable timestamps only for valid API schedules', () => {
  assert.equal(parseScheduleTimestamp('2099.10.11 12:00'), new Date(2099, 9, 11, 12, 0).getTime());
  assert.equal(parseScheduleTimestamp('2099.99.99 99:99'), undefined);
  assert.equal(parseScheduleTimestamp('일정 미정'), undefined);
});
