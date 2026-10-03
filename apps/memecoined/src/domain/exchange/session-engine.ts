import type { ExchangeCandle } from "./types.js";

export const tradingTimeZone = "America/New_York";
export type SessionLevelStatus = "building" | "locked" | "incomplete";

export interface SessionBoundaries {
  readonly civilDate: string;
  readonly asianStart: Date;
  readonly asianEnd: Date;
  readonly londonMarker: Date;
  readonly entryStart: Date;
  readonly entryEnd: Date;
  readonly startOffsetMinutes: number;
  readonly endOffsetMinutes: number;
}

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: tradingTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function parts(date: Date): Record<string, number> {
  return Object.fromEntries(formatter.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
}

function localToUtc(civilDate: string, hour: number): Date {
  const [yearText, monthText, dayText] = civilDate.split("-");
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  if (![year, month, day].every(Number.isInteger)) throw new Error("Invalid civil date");
  const target = Date.UTC(year, month - 1, day, hour);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = parts(new Date(candidate));
    const represented = Date.UTC(actual.year!, actual.month! - 1, actual.day!, actual.hour!, actual.minute!, actual.second!);
    const difference = target - represented;
    candidate += difference;
    if (difference === 0) break;
  }
  const resolved = new Date(candidate);
  const check = parts(resolved);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour) throw new Error("Civil time is ambiguous or nonexistent");
  return resolved;
}

function offsetMinutes(civilDate: string, hour: number, resolved: Date): number {
  const [year, month, day] = civilDate.split("-").map(Number);
  return (Date.UTC(year!, month! - 1, day!, hour) - resolved.valueOf()) / 60_000;
}

export function newYorkCivilDate(instant: Date): string {
  const value = parts(instant);
  return `${value.year!.toString().padStart(4, "0")}-${value.month!.toString().padStart(2, "0")}-${value.day!.toString().padStart(2, "0")}`;
}

export function sessionBoundaries(civilDate: string): SessionBoundaries {
  const asianStart = localToUtc(civilDate, 0), asianEnd = localToUtc(civilDate, 8);
  const entryStart = localToUtc(civilDate, 13), entryEnd = localToUtc(civilDate, 21);
  return Object.freeze({ civilDate, asianStart, asianEnd, londonMarker: asianEnd, entryStart, entryEnd,
    startOffsetMinutes: offsetMinutes(civilDate, 0, asianStart), endOffsetMinutes: offsetMinutes(civilDate, 21, entryEnd) });
}

export function entriesAllowed(now: Date, boundaries: SessionBoundaries): boolean {
  return now >= boundaries.entryStart && now < boundaries.entryEnd;
}

export interface AsianRange {
  readonly status: SessionLevelStatus;
  readonly high: string | null;
  readonly low: string | null;
  readonly contributingCandles: number;
}

export function calculateAsianRange(candles: readonly ExchangeCandle[], boundaries: SessionBoundaries, now: Date): AsianRange {
  const selected = candles.filter((candle) => candle.interval === "1h" && candle.closed && candle.openTime >= boundaries.asianStart && candle.openTime < boundaries.asianEnd);
  const unique = new Map(selected.map((candle) => [candle.openTime.toISOString(), candle]));
  const complete = unique.size === 8;
  if (unique.size === 0) return Object.freeze({ status: now >= boundaries.asianEnd ? "incomplete" : "building", high: null, low: null, contributingCandles: 0 });
  const values = [...unique.values()];
  const high = Math.max(...values.map((x) => Number(x.high))).toString();
  const low = Math.min(...values.map((x) => Number(x.low))).toString();
  return Object.freeze({ status: now < boundaries.asianEnd ? "building" : complete ? "locked" : "incomplete", high, low, contributingCandles: unique.size });
}
