/**
 * Lead Router — Google Calendar availability
 *
 * Pulls Mark's primary-calendar busy windows via freebusy and renders a
 * human-readable list of openings for the {{available_slots}} template
 * variable.
 */

import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { getRouterOAuth2Client } from './gmail';

export function getRouterCalendar(): calendar_v3.Calendar {
  return google.calendar({ version: 'v3', auth: getRouterOAuth2Client() });
}

export interface SlotsOptions {
  /** Days from now to search */
  days_ahead?: number;
  /** Minutes per slot */
  slot_duration_minutes?: number;
  /** Local hour to start each business day (24-hr) */
  business_hours_start?: number;
  /** Local hour to end each business day (24-hr) */
  business_hours_end?: number;
  /** Maximum slots to return */
  max_slots?: number;
  /** Calendar ID; default 'primary' */
  calendar_id?: string;
  /** IANA timezone; default America/New_York */
  timezone?: string;
}

/**
 * Returns a human-readable string like:
 *   "Tuesday at 2pm, Wednesday at 10am, or Thursday at 3pm"
 *
 * Falls back to "any time that works for you" on Calendar API failure.
 */
export async function getAvailableSlots(opts: SlotsOptions = {}): Promise<string> {
  const {
    days_ahead = 5,
    slot_duration_minutes = 30,
    business_hours_start = 9,
    business_hours_end = 17,
    max_slots = 3,
    calendar_id = 'primary',
    timezone = 'America/New_York',
  } = opts;

  try {
    const cal = getRouterCalendar();

    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1); // soonest = next top-of-hour
    const end = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);

    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        timeZone: timezone,
        items: [{ id: calendar_id }],
      },
    });

    const busy = fb.data.calendars?.[calendar_id]?.busy ?? [];

    const slots = findOpenSlots({
      from: start,
      to: end,
      busy: busy.map((b) => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
      })),
      slot_minutes: slot_duration_minutes,
      hour_start: business_hours_start,
      hour_end: business_hours_end,
      timezone,
      max: max_slots,
    });

    if (slots.length === 0) {
      return 'any time that works for you';
    }

    return formatSlotsHuman(slots, timezone);
  } catch {
    return 'any time that works for you';
  }
}

// ---------------------------------------------------------------------------
// Slot finder — pure logic, easy to unit-test later
// ---------------------------------------------------------------------------

interface BusyWindow {
  start: Date;
  end: Date;
}

/** Local hour-of-day in the target timezone (0-23). */
function localHour(d: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(fmt.format(d), 10);
}

/** Local day-of-week in the target timezone (0=Sun … 6=Sat). */
function localDow(d: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const name = fmt.format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

function findOpenSlots(p: {
  from: Date;
  to: Date;
  busy: BusyWindow[];
  slot_minutes: number;
  hour_start: number;
  hour_end: number;
  timezone: string;
  max: number;
}): Date[] {
  const out: Date[] = [];
  const stepMs = p.slot_minutes * 60 * 1000;

  let cursor = new Date(p.from);
  // Snap to slot boundary
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / p.slot_minutes) * p.slot_minutes, 0, 0);

  while (cursor < p.to && out.length < p.max) {
    const dow = localDow(cursor, p.timezone);
    const hr = localHour(cursor, p.timezone);
    const inBizHours =
      dow >= 1 && dow <= 5 && hr >= p.hour_start && hr < p.hour_end;

    if (inBizHours) {
      const slotEnd = new Date(cursor.getTime() + stepMs);
      const overlaps = p.busy.some(
        (b) => cursor < b.end && slotEnd > b.start
      );
      if (!overlaps) {
        out.push(new Date(cursor));
      }
    }

    cursor = new Date(cursor.getTime() + stepMs);
  }

  return out;
}

function formatSlotsHuman(slots: Date[], _timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZone: _timezone,
  });

  const parts = slots.map((d) => {
    const text = fmt.format(d);
    // "Tuesday, 2:00 PM" → "Tuesday at 2pm"
    return text
      .replace(/, /, ' at ')
      .replace(/:00\s?(AM|PM)/i, (_m, ap: string) => ap.toLowerCase())
      .replace(/\s?(AM|PM)/i, (_m, ap: string) => ap.toLowerCase());
  });

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} or ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`;
}
