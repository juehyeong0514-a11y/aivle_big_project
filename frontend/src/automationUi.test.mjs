import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { automationRecoveryActionsFor, automationStateFor, deriveAutomationSummary, filterInvocationLogs, invocationLogView, localizeAutomationFailure, paginateInvocationLogs, selectAutomationScope, sortAutomationExams } from './automationUi.mjs';

test('full invocation history replaces the latest list instead of rendering both panels', () => {
  assert.equal(invocationLogView(false), 'latest');
  assert.equal(invocationLogView(true), 'all');
});

test('completed result mail is not rendered as a second status line', async () => {
  const source = await readFile(new URL('./supervisor/ReportsTab.jsx', import.meta.url), 'utf8');
  assert.equal((source.match(/className="automation-mail-sent"/g) || []).length, 0, 'the mail-sent status must not duplicate the automation badge');
});

test('automation helpers derive candidate states, recovery actions, and aggregate progress', () => {
  const waiting = automationStateFor({}, { status: 'PENDING' });
  assert.deepEqual({ status: waiting.status, label: waiting.label }, { status: 'PENDING', label: '자동 처리 대기' });
  assert.equal(automationStateFor(null, null, null).status, 'WAITING');
  assert.deepEqual(deriveAutomationSummary(null, null), { total: 0, completed: 0, processing: 0, failed: 0, absent: 0, excluded: 0, emailSent: 0, emailFailed: 0, progress: 0 });

  const completed = automationStateFor({}, { automationStatus: 'COMPLETED', resultEmailStatus: 'SENT' });
  assert.equal(completed.status, 'EMAIL_SENT');
  assert.equal(completed.emailSent, true);

  const absent = automationStateFor({ resultStatus: 'ABSENT' });
  assert.equal(absent.status, 'ABSENT');
  assert.equal(absent.excluded, true);

  const excluded = automationStateFor({ status: 'FORCE_TERMINATED' }, undefined, undefined, true);
  assert.equal(excluded.status, 'EXCLUDED');
  assert.deepEqual(automationRecoveryActionsFor({ status: 'FORCE_TERMINATED' }, { id: 'excluded' }, undefined, true), []);

  const gradingFailure = { candidateId: 'candidate-failed', automationStatus: 'GRADING_FAILED', automationFailureReason: 'AI timeout' };
  const retryRequest = { id: 'request-failed', autoTriggered: true };
  const failedState = automationStateFor(gradingFailure, retryRequest);
  assert.equal(failedState.status, 'GRADING_FAILED');
  assert.equal(failedState.reason, 'AI timeout');
  assert.deepEqual(automationRecoveryActionsFor(gradingFailure, retryRequest), ['RETRY_GRADING']);

  const emailFailure = { candidateId: 'candidate-mail', automationStatus: 'EMAIL_FAILED', resultEmailStatus: 'FAILED', resultEmailFailureReason: 'SMTP unavailable' };
  const emailRequest = { id: 'request-mail' };
  const emailState = automationStateFor(emailFailure, emailRequest);
  assert.equal(emailState.status, 'EMAIL_FAILED');
  assert.deepEqual(automationRecoveryActionsFor(emailFailure, emailRequest), ['RESEND_EMAIL']);
  assert.equal(localizeAutomationFailure('Result email delivery failed; manual resend is available.'), '결과 메일 발송에 실패했습니다. 메일 재발송으로 복구할 수 있습니다.');

  const summary = deriveAutomationSummary(
    [{ candidateId: 'waiting' }, { candidateId: 'completed' }, { candidateId: 'absent', resultStatus: 'ABSENT' }, { candidateId: 'excluded', status: 'FORCE_TERMINATED' }, gradingFailure, emailFailure],
    [{ candidateId: 'waiting', status: 'PENDING' }, { candidateId: 'completed', automationStatus: 'COMPLETED', resultEmailStatus: 'SENT' }, { candidateId: 'failed', ...retryRequest }, { candidateId: 'mail', ...emailRequest }],
  );
  assert.deepEqual(summary, { total: 6, completed: 1, processing: 0, failed: 2, absent: 1, excluded: 1, emailSent: 1, emailFailed: 1, progress: 50 });
});

test('automation helpers safely normalize malformed payloads and backend failure states', () => {
  assert.equal(automationStateFor({ automationStatus: 'EMAIL_FAILED', resultEmailStatus: 'FAILED' }, { id: 'mail' }).status, 'EMAIL_FAILED');
  assert.deepEqual(automationRecoveryActionsFor({ automationStatus: 'EMAIL_FAILED' }, { id: 'mail' }), ['RESEND_EMAIL']);
  assert.equal(automationStateFor({ automationStatus: 'ABSENT' }, { id: 'absent' }).excluded, true);
  assert.equal(automationStateFor({ automationStatus: 'EXCLUDED' }, { id: 'excluded' }).excluded, true);
  assert.equal(deriveAutomationSummary('not-an-array', { malformed: true }).total, 0);
});

test('invocation log filters search candidate/exam and paginate twenty records', () => {
  const logs = [
    { id: '1', status: 'COMPLETED', candidateName: '김하늘', examTitle: '컴퓨터 공학' },
    { id: '2', status: 'FAILED', candidateName: '이수민', examTitle: '자료구조' },
    { id: '3', status: 'EMAIL_FAILED', candidateName: '박서준', examTitle: '컴퓨터 공학' },
    ...Array.from({ length: 21 }, (_, index) => ({ id: `extra-${index}`, status: 'COMPLETED', candidateName: `후보${index}`, examTitle: '기타 시험' })),
  ];
  assert.deepEqual(filterInvocationLogs(logs, { status: 'FAILED' }).map((log) => log.id), ['2', '3']);
  assert.deepEqual(filterInvocationLogs(logs, { query: '컴퓨터 공학' }).map((log) => log.id), ['1', '3']);
  const page = paginateInvocationLogs(logs, 2, 20);
  assert.equal(page.page, 2);
  assert.equal(page.totalPages, 2);
  assert.equal(page.total, 24);
  assert.equal(page.items.length, 4);
  assert.equal(paginateInvocationLogs(logs, 99, 20).page, 2);
});

test('automation exam scope sorts newest first and filters requests/candidates consistently', () => {
  const exams = sortAutomationExams([{ id: 'old', title: '이전 시험', date: '2026.08.01 09:00' }, { id: 'new', title: '최신 시험', date: '2026.08.13 09:00' }, { id: 'unknown', title: '날짜 없음' }]);
  assert.deepEqual(exams.map((exam) => exam.id), ['new', 'old', 'unknown']);
  const scoped = selectAutomationScope([{ examId: 'new', candidateId: 'one' }, { examId: 'old', candidateId: 'two' }], 'new');
  assert.deepEqual(scoped.map((item) => item.candidateId), ['one']);
  assert.equal(selectAutomationScope(scoped, 'ALL').length, 1);
});
