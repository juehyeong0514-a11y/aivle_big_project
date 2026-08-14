import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRequestExamStartBypass } from './examStartBypass.mjs';

test('requests the server-controlled start bypass whenever the hidden shortcut is enabled in the waiting room', () => {
  assert.equal(shouldRequestExamStartBypass({ shortcutEnabled: true, waitingRoomVisible: true, requestSent: false }), true);
  assert.equal(shouldRequestExamStartBypass({ shortcutEnabled: false, waitingRoomVisible: true, requestSent: false }), false);
  assert.equal(shouldRequestExamStartBypass({ shortcutEnabled: true, waitingRoomVisible: false, requestSent: false }), false);
  assert.equal(shouldRequestExamStartBypass({ shortcutEnabled: true, waitingRoomVisible: true, requestSent: true }), false);
});
