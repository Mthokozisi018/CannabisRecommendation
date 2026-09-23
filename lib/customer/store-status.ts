const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutes(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

function timeLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function entryParts(raw: unknown) {
  let openValue: unknown;
  let closeValue: unknown;
  if (typeof raw === "string") [openValue, closeValue] = raw.split(/\s*-\s*/, 2);
  else if (Array.isArray(raw)) [openValue, closeValue] = raw;
  else if (raw && typeof raw === "object") {
    const entry = raw as Record<string, unknown>;
    if (entry.closed === true || entry.isClosed === true) return { closed: true, openValue, closeValue };
    openValue = entry.open ?? entry.opens;
    closeValue = entry.close ?? entry.closes;
  }
  return { closed: false, openValue, closeValue };
}

function currentDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "weekday")?.value.toLowerCase();
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const dayIndex = day ? dayKeys.indexOf(day) : -1;
  return { dayIndex, hour, minute };
}

function dayEntry(openingHours: Record<string, unknown>, dayIndex: number) {
  const key = dayKeys[dayIndex];
  return openingHours[key] ?? openingHours[key.slice(0, 3)];
}

function hoursFromEntry(raw: unknown) {
  if (!raw) return null;
  const { closed, openValue, closeValue } = entryParts(raw);
  if (closed) return "Closed today";
  const opens = timeLabel(openValue);
  const closes = timeLabel(closeValue);
  return opens && closes ? `${opens} - ${closes}` : null;
}

export function getStoreOpenState(openingHours: Record<string, unknown>, now = new Date()) {
  const { dayIndex, hour, minute } = currentDay(now);
  if (dayIndex < 0) return null;
  const raw = dayEntry(openingHours, dayIndex);
  if (!raw) return null;
  const { closed, openValue, closeValue } = entryParts(raw);
  if (closed) return { open: false, label: "Closed" };
  const opens = minutes(openValue);
  const closes = minutes(closeValue);
  if (opens === null || closes === null) return null;
  const current = hour * 60 + minute;
  const open = closes > opens ? current >= opens && current < closes : current >= opens || current < closes;
  return { open, label: open ? "Open now" : "Closed" };
}

export function getStoreTradingHoursLabel(openingHours: Record<string, unknown>, now = new Date()) {
  const { dayIndex } = currentDay(now);
  const todayLabel = dayIndex >= 0 ? hoursFromEntry(dayEntry(openingHours, dayIndex)) : null;
  if (todayLabel) return todayLabel;

  const nextOpenDayIndex = dayKeys.findIndex((_, index) => hoursFromEntry(dayEntry(openingHours, index)));
  if (nextOpenDayIndex < 0) return "Hours unavailable";
  const nextLabel = hoursFromEntry(dayEntry(openingHours, nextOpenDayIndex));
  return nextLabel ? `${dayLabels[nextOpenDayIndex]} ${nextLabel}` : "Hours unavailable";
}
