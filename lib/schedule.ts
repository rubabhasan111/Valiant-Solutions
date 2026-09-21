// Pure date and amount maths for instalment schedules. Safe to import on the client.
// Dates are ISO calendar dates (YYYY-MM-DD) and are never run through local time zones.

export type Frequency = "weekly" | "fortnightly" | "monthly";

export const FREQUENCIES: Frequency[] = ["weekly", "fortnightly", "monthly"];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

export const MIN_INSTALMENTS = 2;
export const MAX_INSTALMENTS = 52;
// Stripe's minimum AUD charge is $0.50; keep every debit at $1.00 or more.
export const MIN_INSTALMENT_CENTS = 100;
// Upper limit for a single plan while the platform runs in test mode.
export const MAX_PLAN_CENTS = 5_000_000;

export type ScheduledInstalment = { sequence: number; amountCents: number; dueDate: string };

export function isFrequency(value: string): value is Frequency {
  return (FREQUENCIES as string[]).includes(value);
}

function dateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

const toIso = (date: Date) => date.toISOString().slice(0, 10);

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = dateParts(value);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Whole days from one calendar date to another; negative if `to` is earlier.
export function daysBetween(from: string, to: string): number {
  const a = dateParts(from);
  const b = dateParts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = dateParts(iso);
  return toIso(new Date(Date.UTC(y, m - 1, d + days)));
}

// Keeps the day of the month where possible; 31 Jan plus one month is 28 (or 29) Feb.
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = dateParts(iso);
  const lastDay = new Date(Date.UTC(y, m + months, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))));
}

function dueDate(start: string, frequency: Frequency, index: number): string {
  if (frequency === "monthly") return addMonths(start, index);
  return addDays(start, index * (frequency === "weekly" ? 7 : 14));
}

// Splits the total into equal instalments. Leftover cents go on the earliest payments,
// so no two instalments differ by more than one cent.
export function buildSchedule(
  totalCents: number,
  count: number,
  frequency: Frequency,
  startDate: string,
): ScheduledInstalment[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => ({
    sequence: i + 1,
    amountCents: base + (i < remainder ? 1 : 0),
    dueDate: dueDate(startDate, frequency, i),
  }));
}

export function todayInSydney(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const displayDate = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  const { y, m, d } = dateParts(iso.slice(0, 10));
  return displayDate.format(new Date(Date.UTC(y, m - 1, d)));
}

const shortDay = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// "Wed 1 Oct", short enough for a text message.
export function formatShortDay(iso: string): string {
  const { y, m, d } = dateParts(iso.slice(0, 10));
  const parts = shortDay.formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

// The current hour (0-23) in Sydney, for keeping texts to daytime.
export function hourInSydney(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" }).format(now),
  );
}

// "today" (for today or an overdue date), "tomorrow", or "on 17 Sept 2026".
export function formatRetryDay(iso: string): string {
  const today = todayInSydney();
  if (iso <= today) return "today";
  if (iso === addDays(today, 1)) return "tomorrow";
  return `on ${formatDate(iso)}`;
}

const displayDateTime = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

// Database timestamps (ISO strings) shown in Sydney time.
export function formatTimestamp(iso: string): string {
  return displayDateTime.format(new Date(iso));
}
