import assert from 'node:assert/strict';
import test from 'node:test';
import { createMonitoringRefreshGate } from './monitoringRefreshGate.mjs';

test('Given an open select menu, When monitoring data refreshes, Then the latest refresh is deferred until focus leaves', () => {
  const gate = createMonitoringRefreshGate();
  const firstSnapshot = { examinees: [{ id: 'first' }], warnings: [] };
  const latestSnapshot = { examinees: [{ id: 'latest' }], warnings: [{ id: 'warning' }] };

  assert.deepEqual(gate.receive(firstSnapshot), firstSnapshot);

  gate.suspend();
  assert.equal(gate.receive(latestSnapshot), null);

  assert.deepEqual(gate.resume(), latestSnapshot);
});

test('Given a deferred refresh, When the selected organization or exam changes, Then the stale refresh is discarded', () => {
  const gate = createMonitoringRefreshGate();
  const staleSnapshot = { examinees: [{ id: 'previous-exam' }], warnings: [] };
  const currentSnapshot = { examinees: [{ id: 'current-exam' }], warnings: [] };

  gate.suspend();
  gate.receive(staleSnapshot);

  gate.discard();

  assert.deepEqual(gate.receive(currentSnapshot), currentSnapshot);
  assert.equal(gate.resume(), null);
});
