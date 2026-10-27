// Date-only recurrence avoids daylight-saving shifts and preserves monthly anchors.
export function repeatDates(rule, from, to) {
  const start = new Date(`${rule.date}T12:00:00Z`);
  const first = new Date(`${from > rule.date ? from : rule.date}T12:00:00Z`);
  const end = rule.until && rule.until < to ? rule.until : to;
  const dates = [];
  for (
    const day = first;
    day.toISOString().slice(0, 10) <= end;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const distance = Math.round((day - start) / 86400000);
    const last = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const matches =
      rule.frequency === 'monthly'
        ? day.getUTCDate() === Math.min(start.getUTCDate(), last)
        : distance % { daily: 1, weekly: 7, biweekly: 14 }[rule.frequency] ===
          0;
    if (matches) dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}
