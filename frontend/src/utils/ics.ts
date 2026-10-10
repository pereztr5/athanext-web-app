/** iCalendar (.ics) files for "Add to calendar": one VEVENT per session, times in UTC. */

export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
  description?: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 20261010T200000Z */
export const icsDate = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

export const icsEscape = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 characters continue on the next line after a space (RFC 5545 3.1).
const fold = (line: string): string => {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`);
  return parts.join("\r\n");
};

export const buildIcs = (events: CalendarEvent[], now = new Date()): string => {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AthaNext//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const event of events) {
    if (isNaN(event.start.getTime()) || isNaN(event.end.getTime())) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SUMMARY:${icsEscape(event.title)}`,
    );
    if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
};
