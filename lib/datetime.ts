import { cookies } from "next/headers";

/**
 * One place for time zones (ENG F11). Pages render on the server, which runs in
 * UTC on Vercel, so dates and times were shown in UTC (a late-evening event
 * could show the next day), and a class or event typed in as 7:30 PM was saved
 * as 7:30 PM UTC. Now the browser tells us its zone once (TimeZoneCookie in the
 * root layout), and every server-side date and time is shown, entered and
 * edited in that zone.
 */

/** Until the browser has reported its zone (the very first page view). */
export const DEFAULT_TIME_ZONE = "America/New_York";
export const TZ_COOKIE = "tz";

export function isTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The viewer's time zone, for formatting dates on the server. */
export async function viewerTimeZone(): Promise<string> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return isTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

/** Wall-clock parts of an instant in `tz`. */
function partsIn(at: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** How far `tz` is ahead of UTC at a given instant, in ms. */
function offsetMs(at: number, tz: string): number {
  const p = partsIn(new Date(at), tz);
  const wall = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return wall - at;
}

/**
 * A date ("2026-11-20") and time ("19:30") typed by someone in `tz` → the
 * instant they mean. Invalid input gives an Invalid Date.
 */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const hhmmss = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const wall = Date.parse(`${date}T${hhmmss}Z`); // the wall clock, read as UTC
  if (Number.isNaN(wall)) return new Date(NaN);
  // The offset at the first guess can differ near a daylight-saving change;
  // a second pass settles it.
  let at = wall - offsetMs(wall, tz);
  at = wall - offsetMs(at, tz);
  return new Date(at);
}

/** The inverse, for edit forms: an instant → { date, time } in `tz`. */
export function utcToZoned(iso: string, tz: string) {
  const p = partsIn(new Date(iso), tz);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
