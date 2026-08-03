import test from 'node:test';
import assert from 'node:assert/strict';
import { getExamCandidateScope } from './candidateScope.mjs';

test('returns only candidates assigned to the current exam', () => {
  const organizationCandidates = [
    { id: 'candidate-1', organizationId: 'org-a', name: '현재 시험 응시자', email: 'assigned@example.com' },
    { id: 'candidate-2', organizationId: 'org-a', name: '다른 시험 응시자', email: 'other@example.com' },
  ];

  const scope = getExamCandidateScope({
    candidates: organizationCandidates,
    assignedCandidateIds: ['candidate-1'],
  });

  assert.deepEqual(scope, {
    candidates: organizationCandidates.slice(0, 1),
    count: 1,
  });
});
