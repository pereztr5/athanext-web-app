/**
 * Requests waiting for their card hold while the family pays for instant sessions first
 * (ATH-94: one checkout for paid sessions, then a second step for requests).
 */
const KEY = "athanext:pending-requests";

export interface PendingRequests {
  occurrenceIds: string[];
  athleteId: string;
  coachNames: string[];
}

export const savePendingRequests = (value: PendingRequests) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Private mode: the family can request from Book again.
  }
};

export const readPendingRequests = (): PendingRequests | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as PendingRequests) : null;
    return value?.occurrenceIds?.length && value.athleteId ? value : null;
  } catch {
    return null;
  }
};

export const clearPendingRequests = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
