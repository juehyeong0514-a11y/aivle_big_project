import assert from 'node:assert/strict';
import test from 'node:test';
import { projectDetectionBoxToCover } from '../supervisor/aiMonitoring.mjs';

test('projects a landscape detection box into a portrait cover preview', () => {
  assert.deepEqual(projectDetectionBoxToCover([.25, .2, .75, .8], 16 / 9, 9 / 16), [0, .2, 1, .8]);
});

test('projects a portrait detection box into a landscape cover preview', () => {
  assert.deepEqual(projectDetectionBoxToCover([.2, .25, .8, .75], 9 / 16, 16 / 9), [.2, 0, .8, 1]);
});

test('omits a detection box outside the visible cover crop', () => {
  assert.equal(projectDetectionBoxToCover([0, .2, .1, .8], 16 / 9, 9 / 16), null);
});
