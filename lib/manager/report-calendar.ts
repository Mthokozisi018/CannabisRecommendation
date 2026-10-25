export const SALES_TIME_ZONE = "Africa/Johannesburg";
export type ManagerSalesWeek = { value: string; label: string; startDate: string; endDate: string };
export const pad = (value: number) => String(value).padStart(2, "0");
export function datePartsInTimeZone(date: Date, timeZone = SALES_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}
function zonedDateTimeToUtc(parts: { year: number; month: number; day: number }, timeZone = SALES_TIME_ZONE) {
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const displayed = datePartsInTimeZone(guess, timeZone);
  const displayedAsUtc = Date.UTC(displayed.year, displayed.month - 1, displayed.day, displayed.hour, displayed.minute, displayed.second);
  return new Date(guess.getTime() - (displayedAsUtc - guess.getTime()));
}
export function currentJohannesburgMonth(now = new Date()) {
  const parts = datePartsInTimeZone(now);
  return `${parts.year}-${pad(parts.month)}`;
}
export function monthBounds(month: string) {
  const parsed = /^([0-9]{4})-([0-9]{2})$/.exec(month);
  if (!parsed) throw new Error("Invalid sales month.");
  const year = Number(parsed[1]);
  const monthNumber = Number(parsed[2]);
  return { start: zonedDateTimeToUtc({ year, month: monthNumber, day: 1 }), end: zonedDateTimeToUtc({ year, month: monthNumber + 1, day: 1 }) };
}
export function currentCalendarKpiBounds(now = new Date()) {
  const current = datePartsInTimeZone(now);
  const currentMonth = `${current.year}-${pad(current.month)}`;
  const weekday = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay() || 7;
  const weekStartParts = { year: current.year, month: current.month, day: current.day - (weekday - 1) };
  const weekStart = zonedDateTimeToUtc(weekStartParts);
  const weekEnd = zonedDateTimeToUtc({ ...weekStartParts, day: weekStartParts.day + 7 });
  const displayDate = (date: Date) => new Intl.DateTimeFormat("en-ZA", { timeZone: SALES_TIME_ZONE, day: "2-digit", month: "short", year: "numeric" }).format(date);
  return {
    month: monthBounds(currentMonth),
    year: { start: zonedDateTimeToUtc({ year: current.year, month: 1, day: 1 }), end: zonedDateTimeToUtc({ year: current.year + 1, month: 1, day: 1 }) },
    currentYearLabel: String(current.year),
    week: { start: weekStart, end: weekEnd },
    currentWeekLabel: `${displayDate(weekStart)} – ${displayDate(new Date(weekEnd.getTime() - 1))}`,
    currentMonthLabel: new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${currentMonth}-01T00:00:00Z`))
  };
}
export function getMonthWeeks(month: string): ManagerSalesWeek[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const result: ManagerSalesWeek[] = [];
  let day = 1;
  while (day <= lastDay) {
    const startWeekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay() || 7;
    const endDay = Math.min(lastDay, day + (7 - startWeekday));
    const startDate = `${month}-${pad(day)}`;
    const endDate = `${month}-${pad(endDay)}`;
    const format = (value: string) => new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
    result.push({ value: startDate, startDate, endDate, label: `${format(startDate)} – ${format(endDate)}` });
    day = endDay + 1;
  }
  return result;
}
