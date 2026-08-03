const localSchedulePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const durationMinutes = (duration) => {
  const minutes = Number.parseInt(String(duration).match(/\d+/)?.[0] ?? '', 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
};

export const calculateExamEndsAt = (schedule, duration) => {
  const match = String(schedule).match(localSchedulePattern);
  const minutes = durationMinutes(duration);
  if (!match || minutes === undefined) return undefined;

  const [, year, month, day, hour, minute] = match;
  const startsAt = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (
    startsAt.getFullYear() !== Number(year)
    || startsAt.getMonth() !== Number(month) - 1
    || startsAt.getDate() !== Number(day)
    || startsAt.getHours() !== Number(hour)
    || startsAt.getMinutes() !== Number(minute)
  ) return undefined;

  return new Date(startsAt.getTime() + minutes * 60 * 1000);
};

export const formatScheduleForApi = (schedule) => {
  const match = String(schedule).match(localSchedulePattern);
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  return `${year}.${month}.${day} ${hour}:${minute}`;
};

export const formatExamEndsAt = (endsAt) => endsAt
  ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(endsAt)
  : '';
