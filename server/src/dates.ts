// All calendar math uses 'YYYY-MM-DD' strings interpreted as UTC midnight.

const DAY_MS = 86_400_000;

export function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDay(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  return toDay(new Date(parseDay(day) + n * DAY_MS));
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a) - parseDay(b)) / DAY_MS);
}

export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && toDay(new Date(parseDay(day))) === day;
}
