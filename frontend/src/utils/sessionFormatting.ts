/**
 * Session formatting utilities
 * Helper functions for formatting session data for display
 */
import { parseISODateLocal } from "@/utils/dateHelpers";
import { formatInstantSpan, lowerPeriod, timeZoneAbbreviation } from "@/utils/viewerTime";

/**
 * Format amount as currency string
 */
export const formatSessionPrice = (amount: number, currency: string = 'USD'): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)}`;
};

/**
 * Get currency symbol from currency code
 */
export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
    cad: '$',
    aud: '$',
  };
  return symbols[currency.toLowerCase()] || '$';
};

/**
 * Format date string (YYYY-MM-DD) to readable format
 */
export const formatSessionDate = (dateOnly: string): string => {
  const date = parseISODateLocal(dateOnly);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format time string (HH:mm) to readable format
 */
export const formatSessionTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return lowerPeriod(date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }));
};

/**
 * Format an ISO datetime string to a readable time (e.g., "10:00 am").
 * Accepts strings like "YYYY-MM-DDTHH:mm:ss".
 */
export const formatISOTime = (isoString: string): string => {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return '';
  }
  return lowerPeriod(date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }));
};

/**
 * Format slot time string (HH:mm:ss) to readable format (e.g., "2:30 pm")
 * Used for coach availability slot times
 */
export const formatSlotTime = (time?: string | null): string => {
  if (!time) return "-";
  return lowerPeriod(new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }));
};

/**
 * Format time range from two time strings
 */
export const formatTimeRange = (startTime: string, endTime: string): string => {
  return `${formatSessionTime(startTime)} - ${formatSessionTime(endTime)}`;
};

/**
 * Build full ISO datetime from date and time components
 */
export const buildISODateTime = (dateOnly: string, timeString: string): string => {
  return `${dateOnly}T${timeString}:00`;
};

/**
 * Infer location type display value
 */
export const getLocationLabel = (locationType: 'online' | 'in-person'): string => {
  return locationType === 'online' ? 'Online' : 'In-Person';
};

/**
 * Get session type display value
 */
export const getSessionTypeLabel = (sessionType: 'individual' | 'group'): string => {
  return sessionType === 'individual' ? 'Individual' : 'Group';
};

/**
 * Format a location string (e.g., "in-person", "online") into a user-friendly display
 */
export const formatLocationDisplay = (location?: string | null): string => {
  if (!location) return '';
  if (location.toLowerCase() === 'in-person') return 'In-Person';
  return location
    .split('-')
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment))
    .join('-');
};

/**
 * Get start metadata for countdown/urgency
 */
export interface StartMeta {
  isUrgent: boolean;
  countdown: string | null;
  startsIn: string | null;
}

export const getStartMeta = (isoStart: string, now: Date): StartMeta => {
  const diffMs = new Date(isoStart).getTime() - now.getTime();
  if (diffMs <= 0) {
    return { isUrgent: false, countdown: null, startsIn: null };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  const isUrgent = diffMs <= 30 * 60 * 1000; // 30 minutes
  
  // Countdown only for urgent (within 30 min)
  const countdown = isUrgent ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : null;
  
  // Format "Starting in" with intelligent duration
  let startsIn: string | null = null;
  if (months > 0) {
    startsIn = `${months} month${months > 1 ? 's' : ''}`;
  } else if (weeks > 0) {
    startsIn = `${weeks} week${weeks > 1 ? 's' : ''}`;
  } else if (days > 0) {
    const remainingHours = hours % 24;
    startsIn = remainingHours > 0 
      ? `${days}d ${remainingHours}h` 
      : `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    startsIn = `${hours}h ${remainingMinutes}m`;
  } else {
    startsIn = `${minutes}m`;
  }

  return { isUrgent, countdown, startsIn };
};

/**
 * Get initials from a name
 */
export const getInitialsFromName = (name: string): string => {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

/**
 * Get avatar URL from name (using dicebear API)
 */
export const getAvatarUrlFromName = (name: string): string => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=edf2ff,ffe4e6,e0f2fe,fef3c7`;
};

const timeParts = (date: Date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { clock: `${hours % 12 || 12}:${minutes}`, period: hours < 12 ? 'am' : 'pm' };
};

/**
 * Format a start/end pair as "4:00 to 5:00 pm", keeping one am/pm when both
 * times share it ("11:30 am to 12:30 pm" otherwise).
 * Accepts Date objects, ISO datetimes, or "HH:mm[:ss]" time strings.
 * With `showZone`, instants shown in `timeZone` get its abbreviation ("4:00 to 5:00 pm EDT").
 */
export const formatTimeSpan = (
  start: Date | string,
  end: Date | string,
  timeZone?: string,
  showZone = false,
): string => {
  const isClock = (value: Date | string) => typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value);
  // Instants (Date / ISO datetime) can be shown in the viewer's zone; bare clock strings cannot.
  if (timeZone && !isClock(start) && !isClock(end)) {
    const span = formatInstantSpan(new Date(start), new Date(end), timeZone);
    return span && showZone ? `${span} ${timeZoneAbbreviation(timeZone, new Date(start))}` : span;
  }
  const toDate = (value: Date | string) =>
    value instanceof Date
      ? value
      : /^\d{1,2}:\d{2}/.test(value)
        ? new Date(`2000-01-01T${value.length === 5 ? `${value}:00` : value}`)
        : new Date(value);
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
  const s = timeParts(startDate);
  const e = timeParts(endDate);
  return s.period === e.period
    ? `${s.clock} to ${e.clock} ${e.period}`
    : `${s.clock} ${s.period} to ${e.clock} ${e.period}`;
};

/**
 * Format an amount without cents when it is a whole number ("$45"), with
 * cents otherwise ("$47.25").
 */
export const formatWholePrice = (amount: number, currency: string = 'USD'): string => {
  const symbol = getCurrencySymbol(currency);
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `${symbol}${rounded}` : `${symbol}${rounded.toFixed(2)}`;
};

/**
 * Sentence-case location label: "In person" / "Online".
 */
export const formatLocationSentence = (location?: string | null): string => {
  if (!location) return '';
  const value = location.toLowerCase();
  if (value === 'in-person' || value === 'in person') return 'In person';
  if (value === 'online') return 'Online';
  const spaced = value.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
