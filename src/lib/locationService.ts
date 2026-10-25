/**
 * Location Service for SINC Platform
 * Provides device geolocation, search suggestions, reverse geocoding,
 * address normalization, and local caching.
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const LOCATION_STORAGE_PREFIX = 'sync_profile_location_';

export interface DisplayLocationParams {
  area?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  placeName?: string | null;
}

export interface NormalizedLocation {
  placeName: string;
  address: string;
  area: string;
  landmark: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  displayLocation: string;
}

export interface LocationValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Format clean human-readable public location string
 * e.g., "Mangaluru, Karnataka" or "Deralakatte, Mangaluru"
 */
export function formatDisplayLocation({ area, city, state, country, placeName }: DisplayLocationParams): string {
  const parts: string[] = [];
  if (area && area !== city) parts.push(area);
  if (city) parts.push(city);
  else if (placeName && !parts.includes(placeName)) parts.push(placeName);
  if (state && !parts.includes(state)) parts.push(state);

  if (parts.length > 0) {
    return parts.slice(0, 2).join(', ');
  }
  if (country) return country;
  return placeName || 'Location not specified';
}

/**
 * Normalize OpenStreetMap Nominatim response into structured location object
 */
export function normalizeNominatimResult(item: any): NormalizedLocation | null {
  if (!item) return null;

  const addr = item.address || {};
  const lat = item.lat ? parseFloat(item.lat) : null;
  const lon = item.lon ? parseFloat(item.lon) : null;

  // Extract place name (university, building, monument, shop, station, etc.)
  const placeName =
    item.name ||
    addr.amenity ||
    addr.university ||
    addr.college ||
    addr.hospital ||
    addr.building ||
    item.display_name?.split(',')[0] ||
    '';

  // Extract street / road / locality
  const houseNumber = addr.house_number || '';
  const road = addr.road || addr.street || '';
  const locality =
    addr.suburb ||
    addr.neighbourhood ||
    addr.residential ||
    addr.village ||
    addr.subdistrict ||
    '';

  // Structured Area / Street
  const areaParts = [road, locality].filter(Boolean);
  const area = areaParts.length > 0
    ? areaParts.join(', ')
    : (locality || road || placeName || '');

  // Extract Landmark if specifically identified by provider; otherwise leave empty
  const landmarkCandidate =
    addr.amenity ||
    addr.university ||
    addr.college ||
    addr.hospital ||
    addr.building ||
    (item.type && !['city', 'administrative', 'residential', 'road', 'village', 'postcode'].includes(item.type) && item.name ? item.name : '');

  const landmark = landmarkCandidate && landmarkCandidate !== area && landmarkCandidate !== locality
    ? landmarkCandidate.trim()
    : '';

  // Extract city
  const city =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.county?.replace(/ taluk/i, '') ||
    addr.state_district ||
    '';

  // State, Country, PIN
  const state = addr.state || '';
  const country = addr.country || 'India';
  const pincode = addr.postcode || '';

  const displayLocation = formatDisplayLocation({ area, city, state, country, placeName });

  return {
    placeName: placeName.trim(),
    address: [houseNumber, road].filter(Boolean).join(' ').trim(),
    area: area.trim(),
    landmark: landmark.trim(),
    city: city.trim(),
    state: state.trim(),
    country: country.trim(),
    pincode: pincode.trim(),
    latitude: lat,
    longitude: lon,
    displayLocation: displayLocation.trim()
  };
}

/**
 * Validate structured location fields
 * Area / Street *, Landmark *, City *, State *, Country *, PIN Code *
 */
export function validateLocationFields(locationData: any): LocationValidationResult {
  const errors: Record<string, string> = {};
  const area = (locationData?.area || '').trim();
  const landmark = (locationData?.landmark || '').trim();
  const city = (locationData?.city || '').trim();
  const state = (locationData?.state || '').trim();
  const country = (locationData?.country || '').trim();
  const pincode = (locationData?.pincode || '').trim();

  if (!area) {
    errors.area = 'Area / Street is required.';
  }
  if (!landmark) {
    errors.landmark = 'Landmark is required. Please enter a nearby landmark.';
  }
  if (!city) {
    errors.city = 'City is required.';
  }
  if (!state) {
    errors.state = 'State is required.';
  }
  if (!country) {
    errors.country = 'Country is required.';
  }

  if (!pincode) {
    errors.pincode = 'PIN Code is required.';
  } else {
    // PIN Code validation
    const isIndia = !country || country.toLowerCase() === 'india';
    if (isIndia) {
      if (!/^\d{6}$/.test(pincode)) {
        errors.pincode = 'Please enter a valid 6-digit PIN code.';
      }
    } else {
      // International postal codes: 4-10 chars, alphanumeric, cannot be purely letters or symbols
      if (!/^[a-zA-Z0-9\s-]{4,10}$/.test(pincode) || /^[a-zA-Z\s-]+$/.test(pincode)) {
        errors.pincode = 'Please enter a valid postal code.';
      }
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors };
}

/**
 * Get device GPS coordinates
 */
export function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let errorMsg = 'Unable to retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission was denied. You can search manually below.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please try again or search manually.';
        }
        reject(new Error(errorMsg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Reverse geocode latitude & longitude into a human-readable address
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<NormalizedLocation | null> {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Valid latitude and longitude numbers are required.');
  }

  const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SINCPlatform/1.0 (https://sincplatform.app)'
    }
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const normalized = normalizeNominatimResult(data);
  if (normalized) {
    normalized.latitude = latitude;
    normalized.longitude = longitude;
  }
  return normalized;
}

/**
 * Search locations by query string (debounced at component level)
 */
export async function searchLocations(query: string): Promise<NormalizedLocation[]> {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim();
  const url = `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(cleanQuery)}&addressdetails=1&limit=6`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SINCPlatform/1.0 (https://sincplatform.app)'
    }
  });

  if (!response.ok) {
    throw new Error(`Location search failed: HTTP ${response.status}`);
  }

  const results = await response.json();
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map(normalizeNominatimResult).filter((item): item is NormalizedLocation => Boolean(item));
}

/**
 * Local storage caching helpers
 */
export function getLocalProfileLocation(userId: string): any | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCATION_STORAGE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[LocationService] Local read error:', e);
  }
  return null;
}

export function saveLocalProfileLocation(userId: string, locationData: any): void {
  if (!userId || !locationData || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCATION_STORAGE_PREFIX}${userId}`, JSON.stringify(locationData));
  } catch (e) {
    console.warn('[LocationService] Local write error:', e);
  }
}
