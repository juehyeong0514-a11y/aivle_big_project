const statusLabels = {
  WAITING: '자동 처리 대기',
  PENDING: '자동 처리 대기',
  FINALIZING: '응시 마감 처리 중',
  PROCESSING: 'AI 채점 중',
  GRADING: 'AI 채점 중',
  COMPLETED: '채점 완료',
  FINALIZED: '자동 처리 완료',
  EMAIL_PENDING: '결과 메일 대기',
  EMAIL_SENDING: '결과 메일 발송 중',
  EMAIL_SENT: '결과 메일 발송 완료',
  GRADING_FAILED: 'AI 채점 실패',
  EMAIL_FAILED: '결과 메일 실패',
  FAILED: '자동 처리 실패',
  ABSENT: '결시·제외',
  EXCLUDED: '강제 종료·제외',
};

const failureReasonLabels = new Map([
  ['Result email delivery failed; manual resend is available.', '결과 메일 발송에 실패했습니다. 메일 재발송으로 복구할 수 있습니다.'],
  ['SendGrid email delivery failed', '결과 메일 전송에 실패했습니다.'],
  ['SendGrid email service is not configured', '결과 메일 서비스가 아직 설정되지 않았습니다.'],
  ['Automatic AI grading failed; manual retry is available.', '자동 AI 채점에 실패했습니다. 관리자 채점 재시도가 필요합니다.'],
  ['Automatic exam processing requires manual review.', '자동 시험 처리에 실패해 관리자 확인이 필요합니다.'],
]);

export const localizeAutomationFailure = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return failureReasonLabels.get(text) || text;
};

const invocationFailureStatuses = new Set(['FAILED', 'GRADING_FAILED', 'EMAIL_FAILED']);

export const filterInvocationLogs = (logs, { status = 'ALL', query = '' } = {}) => {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const normalizedStatus = String(status || 'ALL').toUpperCase();
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  return safeLogs.filter((log) => {
    const logStatus = String(log?.status || 'UNKNOWN').toUpperCase();
    const statusMatch = normalizedStatus === 'ALL'
      || (normalizedStatus === 'FAILED' ? invocationFailureStatuses.has(logStatus) : normalizedStatus === 'COMPLETED' ? logStatus === 'COMPLETED' : logStatus === normalizedStatus);
    if (!statusMatch) return false;
    if (!normalizedQuery) return true;
    return [log?.candidateName, log?.examineeName, log?.questionTitle, log?.examTitle, log?.examId]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
};

export const paginateInvocationLogs = (logs, page = 1, pageSize = 20) => {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const totalPages = Math.max(1, Math.ceil(safeLogs.length / safePageSize));
  const currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  return { items: safeLogs.slice((currentPage - 1) * safePageSize, currentPage * safePageSize), page: currentPage, pageSize: safePageSize, total: safeLogs.length, totalPages };
};

export const invocationLogView = (showAll) => showAll ? 'all' : 'latest';

const automationExamTimestamp = (exam) => {
  const value = exam?.scheduledAt || exam?.startAt || exam?.examDate || exam?.date || exam?.createdAt || exam?.updatedAt;
  const timestamp = value ? Date.parse(String(value).replace(/\./g, '-')) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const sortAutomationExams = (exams) => (Array.isArray(exams) ? [...exams] : []).sort((first, second) => automationExamTimestamp(second) - automationExamTimestamp(first));

export const selectAutomationScope = (items, examId = 'ALL') => {
  const safeItems = Array.isArray(items) ? items : [];
  return !examId || examId === 'ALL' ? safeItems : safeItems.filter((item) => item?.examId === examId);
};

const latestRequestFor = (requests, candidateId) => requests
  .filter((item) => item?.candidateId === candidateId)
  .sort((first, second) => new Date(second?.requestedAt ?? 0) - new Date(first?.requestedAt ?? 0))[0];

export const automationStateFor = (result = {}, request, examinee, forceTerminated = false) => {
  result = result && typeof result === 'object' ? result : {};
  request = request && typeof request === 'object' ? request : undefined;
  examinee = examinee && typeof examinee === 'object' ? examinee : undefined;
  const resultStatus = String(result.resultStatus || result.status || result.automationStatus || '').toUpperCase();
  if (forceTerminated || ['DISQUALIFIED', 'EXCLUDED', 'FORCE_TERMINATED'].includes(resultStatus) || request?.automationStatus === 'EXCLUDED') return { status: 'EXCLUDED', label: statusLabels.EXCLUDED, reason: request?.automationFailureReason || result.automationFailureReason || '강제 종료 또는 탈락 처리된 응시자입니다.', excluded: true };
  const status = request?.automationStatus || result.automationStatus || request?.status || (result.resultStatus === 'ABSENT' ? 'ABSENT' : 'WAITING');
  const normalized = String(status).toUpperCase();
  if (normalized === 'ABSENT' || result.resultStatus === 'ABSENT' || examinee?.status === 'ABSENT') return { status: 'ABSENT', label: statusLabels.ABSENT, reason: request?.automationFailureReason || result.automationFailureReason || '시험 종료 시각까지 시험을 시작하지 않아 결시 처리되었습니다.', excluded: true };
  const emailStatus = String(request?.resultEmailStatus || result.resultEmailStatus || (request?.resultEmailedAt || result.resultEmailedAt ? 'SENT' : '')).toUpperCase();
  const reason = request?.automationFailureReason || result.automationFailureReason || request?.errorMessage || result.errorMessage || '';
  if (normalized === 'EMAIL_FAILED') return { status: 'EMAIL_FAILED', label: statusLabels.EMAIL_FAILED, reason: request?.resultEmailFailureReason || result.resultEmailFailureReason || reason || '결과 메일 발송에 실패했습니다.', emailFailed: true };
  if (normalized === 'EMAIL_SENT') return { status: 'EMAIL_SENT', label: statusLabels.EMAIL_SENT, reason: '', completed: true, emailSent: true };
  if (normalized === 'FINALIZED') return { status: 'FINALIZED', label: statusLabels.FINALIZED, reason: '', completed: true };
  if (normalized === 'COMPLETED' && ['FAILED', 'ERROR'].includes(emailStatus)) return { status: 'EMAIL_FAILED', label: statusLabels.EMAIL_FAILED, reason: request?.resultEmailFailureReason || result.resultEmailFailureReason || reason || '결과 메일 발송에 실패했습니다.', emailFailed: true };
  if (normalized === 'COMPLETED' && (emailStatus === 'SENT' || request?.resultEmailedAt || result.resultEmailedAt)) return { status: 'EMAIL_SENT', label: statusLabels.EMAIL_SENT, reason: '', completed: true, emailSent: true };
  if (normalized === 'COMPLETED') return { status: 'EMAIL_PENDING', label: statusLabels.EMAIL_PENDING, reason: '', completed: true };
  if (['FAILED', 'GRADING_FAILED', 'ERROR'].includes(normalized)) return { status: 'GRADING_FAILED', label: statusLabels[normalized] || statusLabels.GRADING_FAILED, reason: reason || 'AI 채점에 실패했습니다.', gradingFailed: true };
  return { status: normalized, label: statusLabels[normalized] || '자동 처리 대기', reason };
};

export const automationRecoveryActionsFor = (result = {}, request, examinee, forceTerminated = false) => {
  const state = automationStateFor(result, request, examinee, forceTerminated);
  if (state.excluded || !request?.id) return [];
  const managerRetryAllowed = request.managerRetryable === true
    || result.managerRetryable === true
    || request.recoveryActions?.includes?.('RETRY_GRADING')
    || result.recoveryActions?.includes?.('RETRY_GRADING')
    || result.automationStatus
    || request.automationStatus
    || request.autoTriggered;
  return [
    ...(state.gradingFailed && managerRetryAllowed ? ['RETRY_GRADING'] : []),
    ...(state.emailFailed ? ['RESEND_EMAIL'] : []),
  ];
};

export const deriveAutomationSummary = (results = [], requests = [], explicitSummary) => {
  if (explicitSummary) return explicitSummary;
  const safeResults = Array.isArray(results) ? results : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const states = safeResults.map((result) => automationStateFor(result, latestRequestFor(safeRequests, result?.candidateId), null, result?.status === 'FORCE_TERMINATED' || result?.resultStatus === 'DISQUALIFIED'));
  const count = (predicate) => states.filter(predicate).length;
  const completed = count((state) => state.completed || state.emailSent);
  const processing = count((state) => ['FINALIZING', 'PROCESSING', 'GRADING', 'EMAIL_SENDING'].includes(state.status));
  const failed = count((state) => state.gradingFailed || state.emailFailed || state.status === 'FAILED');
  const absent = count((state) => state.status === 'ABSENT');
  const excluded = count((state) => state.excluded && state.status !== 'ABSENT');
  const emailSent = count((state) => state.emailSent);
  const emailFailed = count((state) => state.emailFailed);
  const total = safeResults.length;
  return { total, completed, processing, failed, absent, excluded, emailSent, emailFailed, progress: total ? Math.round((completed + absent + excluded) / total * 100) : 0 };
};
