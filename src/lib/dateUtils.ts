const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getMondayISO(date: Date): string {
  const d = new Date(date);
  // Use UTC to avoid DST shifts
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// On Saturday or Sunday, default to next week — the current M–F has passed or is about to
export function getDefaultWeekMonday(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 6=Sat
  const monday = getMondayISO(today);
  return day === 0 || day === 6 ? addWeeks(monday, 1) : monday;
}

export function addWeeks(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split('T')[0];
}

export function formatWeekRange(mondayISO: string): string {
  const monday = new Date(mondayISO + 'T12:00:00');
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const mStr = `${MONTHS[monday.getMonth()]} ${monday.getDate()}`;
  const fStr = `${MONTHS[friday.getMonth()]} ${friday.getDate()}`;
  return `${mStr} – ${fStr}`;
}

export function weekRelativeLabel(mondayISO: string): string {
  const thisMonday = getMondayISO(new Date());
  if (mondayISO === thisMonday) return 'This Week';
  const diff = Math.round(
    (new Date(mondayISO + 'T12:00:00').getTime() - new Date(thisMonday + 'T12:00:00').getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  );
  if (diff === -1) return 'Last Week';
  if (diff === 1) return 'Next Week';
  if (diff > 0) return `${diff} weeks ahead`;
  return `${Math.abs(diff)} weeks ago`;
}

export function getDayDate(mondayISO: string, dayName: string): string {
  const idx = DAYS.indexOf(dayName);
  if (idx < 1) return mondayISO;
  const d = new Date(mondayISO + 'T12:00:00');
  d.setDate(d.getDate() + (idx - 1));
  return d.toISOString().split('T')[0];
}

export function getTodayDayName(): string {
  return DAYS[new Date().getDay()];
}

export function isCurrentWeek(mondayISO: string): boolean {
  return mondayISO === getMondayISO(new Date());
}

export function isoToDisplay(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
