/**
 * Utility functions for geolocation lookups
 * Supports both US zip codes and international postal codes
 */

export interface LocationInfo {
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Fetches location information based on a zip/postal code
 * Uses two APIs: zippopotam.us for US codes, and Nominatim for international
 *
 * @param zip - The zip code or postal code to look up
 * @returns Promise<LocationInfo | null> - Location details or null if not found
 */
export async function fetchLocationFromZipCode(zip: string): Promise<LocationInfo | null> {
  if (!zip || zip.length < 3) {
    return null;
  }

  try {
    // Try US zip code lookup first
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`);

    if (response.ok) {
      const data = await response.json();
      return {
        city: data?.places?.[0]?.['place name'],
        state: data?.state,
        country: data?.country,
      };
    } else if (response.status === 404) {
      // 404 means zip code not found in US database, try international
    }
  } catch (error) {
    console.error('Error fetching location from zippopotam:', error);
  }

  // Try alternate API for international zip codes
  try {
    const geoResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip}&format=json&limit=1`
    );

    if (geoResponse.ok) {
      const geoData = await geoResponse.json();
      if (geoData.length > 0) {
        const place = geoData[0];
        return {
          city: place.address?.city || place.address?.town,
          state: place.address?.state,
          country: place.address?.country,
        };
      } else {
        // Empty array means postal code not found
        return null;
      }
    } else if (geoResponse.status === 404) {
      return null;
    }
  } catch (error) {
    console.error('Error fetching location from nominatim:', error);
  }

  // If we reach here, no location was found from either API
  return null;
}

/**
 * Format location info for display
 * @param locationInfo - The location information object
 * @returns Formatted location string or empty string if no valid data
 */
export function formatLocationDisplay(locationInfo: LocationInfo | null): string {
  if (!locationInfo) return '';

  const parts = [locationInfo.city, locationInfo.state, locationInfo.country]
    .filter(Boolean)
    .filter(part => typeof part === 'string' && part.trim() !== '');
  
  return parts.length > 0 ? parts.join(', ') : '';
}

/**
 * Check if location info has valid data
 * @param locationInfo - The location information object
 * @returns true if location has at least one valid field
 */
export function hasValidLocationData(locationInfo: LocationInfo | null): boolean {
  if (!locationInfo) return false;
  
  return Boolean(
    (locationInfo.city && locationInfo.city.trim() !== '') ||
    (locationInfo.state && locationInfo.state.trim() !== '') ||
    (locationInfo.country && locationInfo.country.trim() !== '')
  );
}

export interface ZipPoint {
  lat: number;
  lng: number;
  /** "Austin, TX" */
  label: string;
}

const zipPoints = new Map<string, Promise<ZipPoint | null>>();

/**
 * The center of a 5-digit US ZIP (zippopotam.us), or null when it can't be found. Cached for
 * the session; never throws.
 */
export function fetchZipPoint(zip: string): Promise<ZipPoint | null> {
  if (!/^\d{5}$/.test(zip)) return Promise.resolve(null);
  const cached = zipPoints.get(zip);
  if (cached) return cached;
  const lookup = fetch(`https://api.zippopotam.us/us/${zip}`)
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json();
      const place = data?.places?.[0];
      const lat = Number(place?.latitude);
      const lng = Number(place?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const city = place?.["place name"] as string | undefined;
      const state = (place?.["state abbreviation"] as string | undefined) || (data?.state as string | undefined);
      return { lat, lng, label: [city, state].filter(Boolean).join(", ") };
    })
    .catch(() => null);
  zipPoints.set(zip, lookup);
  lookup.then((point) => {
    if (!point) zipPoints.delete(zip);
  });
  return lookup;
}
