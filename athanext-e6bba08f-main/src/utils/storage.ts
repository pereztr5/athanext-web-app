import { ATHLETE_PROFILE_CONSTANTS } from './db';

const { STORAGE_PUBLIC_MARKER } = ATHLETE_PROFILE_CONSTANTS;

export const getStoragePathFromPublicUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const markerIndex = url.indexOf(STORAGE_PUBLIC_MARKER);
  if (markerIndex === -1) return null;
  const path = url.slice(markerIndex + STORAGE_PUBLIC_MARKER.length).trim();
  return path || null;
};
