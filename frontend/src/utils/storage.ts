import { ATHLETE_PROFILE_CONSTANTS } from './db';

const { STORAGE_PUBLIC_MARKER } = ATHLETE_PROFILE_CONSTANTS;

export const getStoragePathFromPublicUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const markerIndex = url.indexOf(STORAGE_PUBLIC_MARKER);
  if (markerIndex === -1) return null;
  // Drop the ?v= cache-buster the app adds to photo URLs; it isn't part of the object name.
  const path = url.slice(markerIndex + STORAGE_PUBLIC_MARKER.length).split(/[?#]/)[0].trim();
  return path || null;
};
