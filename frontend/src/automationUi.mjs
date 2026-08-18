const statusLabels = {
  ASSIGNING: '시험 배정 중',
  WAITING_INVITATION: '초대 발송 대기',
  INVITING: '초대 발송 중',
  WAITING_EXAM: '시험 시작 대기',
  WAITING: '자동 처리 대기',
  PENDING: '자동 처리 대기',
  FINALIZING: '응시 마감 처리 중',
  PROCESSING: 'AI 채점 중',
  GRADING: 'AI 채점 중',
  REPORTING: '결과 리포트 생성 중',
  COMPLETED: '채점 완료',
  FINALIZED: '자동 처리 완료',
  EMAIL_PENDING: '결과 메일 대기',
  EMAIL_SENDING: '결과 메일 발송 중',
  EMAIL_SENT: '결과 메일 발송 완료',
  REVIEW_REQUIRED: '검토 후 발송 보류',
  GRADING_FAILED: 'AI 채점 실패',
  EMAIL_FAILED: '결과 메일 실패',
  INVITATION_FAILED: '초대 발송 실패',
  FAILED: '자동 처리 실패',
  ABSENT: '결시·제외',
  EXCLUDED: '강제 종료·제외',
};

const automationPhaseStatuses = new Set([
  'ASSIGNING', 'WAITING_INVITATION', 'INVITING', 'WAITING_EXAM',
  'FINALIZING', 'GRADING', 'REPORTING', 'EMAIL_SENDING', 'COMPLETED',
  'REVIEW_REQUIRED', 'INVITATION_FAILED', 'GRADING_FAILED', 'EMAIL_FAILED',
]);

const UNKNOWN_AUTOMATION_LABEL = '자동 처리 상태 확인 필요';

export const automationPhaseFor = (value = {}) => {
  const payload = typeof value === 'string' ? { automationStatus: value } : (value && typeof value === 'object' ? value : {});
  const raw = payload.automationStatus || payload.status || payload.phase || '';
  const status = String(raw).trim().toUpperCase();
  if (!automationPhaseStatuses.has(status)) return { status: 'UNKNOWN', label: UNKNOWN_AUTOMATION_LABEL };
  return { status, label: statusLabels[status] || UNKNOWN_AUTOMATION_LABEL };
};

const deliveryLabels = {
  SENT: '결과 메일 발송 완료',
  HELD: '검토 필요로 발송 보류',
  AWAITING_SEND: '결과 메일 발송 대기',
  SENDING: '결과 메일 발송 중',
  FAILED: '결과 메일 발송 실패',
};

export const automationDeliveryStatusFor = (value = {}) => {
  const payload = value && typeof value === 'object' ? value : {};
  const reviewStatus = String(payload.reviewStatus || payload.resultReviewStatus || '').trim().toUpperCase();
  const emailStatus = String(payload.resultEmailStatus || payload.emailStatus || '').trim().toUpperCase();
  if (['REVIEW_REQUIRED', 'HELD', 'HOLD'].includes(reviewStatus) || ['REVIEW_REQUIRED', 'HELD', 'HOLD'].includes(emailStatus)) return { status: 'HELD', label: deliveryLabels.HELD };
  if (['SENT', 'EMAIL_SENT'].includes(emailStatus) || payload.resultEmailedAt || payload.email?.sentAt) return { status: 'SENT', label: deliveryLabels.SENT };
  if (['SENDING', 'EMAIL_SENDING'].includes(emailStatus)) return { status: 'SENDING', label: deliveryLabels.SENDING };
  if (['FAILED', 'EMAIL_FAILED'].includes(emailStatus)) return { status: 'FAILED', label: deliveryLabels.FAILED };
  if (!emailStatus || ['PENDING', 'AWAITING_SEND', 'EMAIL_PENDING', 'NOT_SENT'].includes(emailStatus)) return { status: 'AWAITING_SEND', label: deliveryLabels.AWAITING_SEND };
  return { status: 'UNKNOWN', label: UNKNOWN_AUTOMATION_LABEL };
};

const exclusionReasonLabels = new Map([
  ['NO_SHOW', '시험 미응시(결시)'],
  ['ABSENT', '시험 미응시(결시)'],
  ['FORCE_TERMINATED', '강제 종료'],
  ['DISQUALIFIED', '부정행위 또는 탈락 처리'],
  ['EXCLUDED', '관리자 제외 처리'],
  ['MANUAL_EXCLUSION', '관리자 수동 제외'],
  ['INVITATION_FAILED', '초대 발송 실패로 제외'],
  ['TEST_CANDIDATE', '테스트 응시자'],
  ['INVALID_EMAIL', '이메일 오류'],
  ['MISSING_BIRTH_DATE', '생년월일 누락'],
  ['STATUS_NOT_REGISTERED', '등록 상태 아님'],
  ['ORGANIZATION_MISMATCH', '다른 조직 응시자'],
  ['DUPLICATE_EMAIL', '중복 이메일'],
  ['DUPLICATE_CANDIDATE', '중복 응시자'],
]);

export const localizeAutomationExclusionReason = (value) => {
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return exclusionReasonLabels.get(key) || '제외 사유를 확인해 주세요.';
};

const parseAutomationDate = (value) => {
  if (!value) return NaN;
  const timestamp = Date.parse(String(value).replace(/\./g, '-'));
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

export const formatAutomationScheduledAt = (value, locale = 'ko-KR') => {
  const timestamp = parseAutomationDate(value);
  if (!Number.isFinite(timestamp)) return '일정 미정';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
};

export const formatAutomationLeadTime = (scheduledAt, now = Date.now()) => {
  const scheduled = parseAutomationDate(scheduledAt);
  const current = typeof now === 'number' ? now : parseAutomationDate(now);
  if (!Number.isFinite(scheduled) || !Number.isFinite(current)) return '시간 미정';
  const minutes = Math.round(Math.abs(scheduled - current) / 60000);
  if (minutes < 1) return '곧 시작';
  const value = minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`;
  return scheduled >= current ? `${value} 전` : `${value} 지남`;
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
  if (normalized === 'REVIEW_REQUIRED' || emailStatus === 'REVIEW_REQUIRED') return { status: 'REVIEW_REQUIRED', label: statusLabels.REVIEW_REQUIRED, reason: reason || '감독 경고 또는 검토 보류 상태라 결과 메일을 발송하지 않았습니다.', reviewRequired: true };
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
  const processing = count((state) => ['ASSIGNING', 'WAITING_INVITATION', 'INVITING', 'WAITING_EXAM', 'FINALIZING', 'PROCESSING', 'GRADING', 'REPORTING', 'EMAIL_SENDING'].includes(state.status));
  const failed = count((state) => state.gradingFailed || state.emailFailed || state.status === 'FAILED');
  const absent = count((state) => state.status === 'ABSENT');
  const excluded = count((state) => state.excluded && state.status !== 'ABSENT');
  const emailSent = count((state) => state.emailSent);
  const emailFailed = count((state) => state.emailFailed);
  const total = safeResults.length;
  return { total, completed, processing, failed, absent, excluded, emailSent, emailFailed, progress: total ? Math.round((completed + absent + excluded) / total * 100) : 0 };
};
