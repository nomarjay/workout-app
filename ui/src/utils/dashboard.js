export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateFromKey(value) {
  return new Date(`${value}T12:00:00`);
}
export function formatDate(
  value,
  options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
) {
  return new Intl.DateTimeFormat(undefined, options).format(dateFromKey(value));
}
export function calendarDays(year, month) {
  const first = new Date(year, month, 1, 12);
  const start = 1 - first.getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, start + index, 12);
    return {
      date: localDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}
export function ageOnDate(birthDate, today) {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  const current = today.split('-').map(Number);
  return (
    current[0] -
    year -
    (current[1] < month || (current[1] === month && current[2] < day) ? 1 : 0)
  );
}
export function estimatedMinutes(workout) {
  return 10 + (workout?.exercises?.length || 0) * 6;
}
export function primaryMusclesFor(workout) {
  const muscles = new Map();
  for (const exercise of workout?.exercises || []) {
    for (const raw of exercise.primaryMuscles || []) {
      if (typeof raw !== 'string') continue;
      const name = raw.trim().replace(/\s+/g, ' ');
      if (name && !muscles.has(name.toLowerCase()))
        muscles.set(name.toLowerCase(), name);
    }
  }
  return [...muscles.values()];
}
export function weekBounds(date) {
  const day = dateFromKey(date);
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() - ((day.getDay() + 6) % 7),
    12
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
    12
  );
  return { start: localDate(start), end: localDate(end) };
}
