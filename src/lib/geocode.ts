/**
 * Soft-fail landmark / area geocode for OfflineApply (Nominatim + Photon).
 * Mirrors loans `/api/geocode` + LandmarkMapInput without a Next.js proxy.
 * Failures never throw to the form — callers keep free-text landmark entry.
 */

export type GeocodeBoundingBox = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type GeocodeSuggestion = {
  placeId: string;
  label: string;
  lat: number;
  lng: number;
  boundingBox?: GeocodeBoundingBox;
};

export type LandmarkLocationContext = {
  county?: string;
  constituency?: string;
  ward?: string;
};

export type MapView = {
  lat: number;
  lng: number;
  delta: number;
  bounds?: GeocodeBoundingBox;
  label?: string;
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const USER_AGENT = 'UwezoFundApp/1.0 (uwezo.go.ke; support@uwezo.go.ke)';
/** Short client timeout — soft-fail quickly offline. */
const FETCH_TIMEOUT_MS = 4500;
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };

export const ZOOM_DELTAS = {
  default: 0.45,
  county: 0.32,
  constituency: 0.09,
  ward: 0.028,
  landmark: 0.012,
} as const;

const suggestionCache = new Map<string, GeocodeSuggestion[]>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBoundingBox(
  boundingbox?: [string, string, string, string] | number[] | string[],
): GeocodeBoundingBox | undefined {
  if (!boundingbox || boundingbox.length !== 4) return undefined;
  const south = Number.parseFloat(String(boundingbox[0]));
  const north = Number.parseFloat(String(boundingbox[1]));
  const west = Number.parseFloat(String(boundingbox[2]));
  const east = Number.parseFloat(String(boundingbox[3]));
  if ([south, north, west, east].some((value) => Number.isNaN(value))) return undefined;
  const latSpan = Math.abs(north - south);
  const lngSpan = Math.abs(east - west);
  if (latSpan < 0.02 && lngSpan < 0.02) return undefined;
  return { south, north, west, east };
}

function buildLabel(parts: Array<string | undefined | null>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(', ');
}

function isKenyaResult(countryCode?: string, label?: string) {
  if (countryCode) return countryCode.toLowerCase() === 'ke';
  return (label || '').toLowerCase().includes('kenya');
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Upstream ${response.status}`);
  return (await response.json()) as T;
}

async function queryNominatim(searchQuery: string, limit: number): Promise<GeocodeSuggestion[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('countrycodes', 'ke');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('q', searchQuery);

  const data = await fetchJson<
    Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      boundingbox?: [string, string, string, string];
    }>
  >(url.toString());

  return data.map((item) => ({
    placeId: `nominatim:${item.place_id}`,
    label: item.display_name,
    lat: Number.parseFloat(item.lat),
    lng: Number.parseFloat(item.lon),
    boundingBox: parseBoundingBox(item.boundingbox),
  }));
}

async function queryPhoton(searchQuery: string, limit: number): Promise<GeocodeSuggestion[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('limit', String(Math.max(limit, 5)));
  url.searchParams.set('lang', 'en');

  const data = await fetchJson<{
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        osm_id?: number;
        osm_type?: string;
        name?: string;
        street?: string;
        district?: string;
        city?: string;
        county?: string;
        state?: string;
        country?: string;
        countrycode?: string;
        extent?: [number, number, number, number];
      };
    }>;
  }>(url.toString());

  const mapped: GeocodeSuggestion[] = [];
  for (const feature of data.features || []) {
    const props = feature.properties || {};
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) continue;
    const [lng, lat] = coordinates;
    const label = buildLabel([
      props.name,
      props.street,
      props.district,
      props.city,
      props.county,
      props.state,
      props.country || 'Kenya',
    ]);
    if (!isKenyaResult(props.countrycode, label)) continue;
    const extent = props.extent;
    const boundingBox = extent
      ? parseBoundingBox([String(extent[1]), String(extent[3]), String(extent[0]), String(extent[2])])
      : undefined;
    mapped.push({
      placeId: `photon:${props.osm_type || 'x'}:${props.osm_id || `${lat},${lng}`}`,
      label: label || searchQuery,
      lat,
      lng,
      boundingBox,
    });
  }
  return mapped.slice(0, limit);
}

function dedupeResults(results: GeocodeSuggestion[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.lat.toFixed(5)}:${result.lng.toFixed(5)}:${result.label.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreAreaResult(result: GeocodeSuggestion, needle: string) {
  const label = result.label.toLowerCase();
  const target = needle.toLowerCase();
  let score = 0;
  if (label.includes(target)) score += 5;
  for (const part of target.split(/[\s/,]+/).filter(Boolean)) {
    if (part.length > 2 && label.includes(part)) score += 1;
  }
  if (/\b(ward|constituency|county|boundary)\b/i.test(result.label)) score += 3;
  return score;
}

function landmarkQueries(
  query: string,
  county?: string | null,
  constituency?: string | null,
  ward?: string | null,
) {
  return [
    ...new Set(
      [
        [query, ward, constituency, county, 'Kenya'].filter(Boolean).join(', '),
        [query, constituency, county, 'Kenya'].filter(Boolean).join(', '),
        [query, county, 'Kenya'].filter(Boolean).join(', '),
        `${query}, Kenya`,
      ].map((value) => value.replace(/\s+/g, ' ').trim()),
    ),
  ];
}

function areaQueries(input: LandmarkLocationContext) {
  const { county, constituency, ward } = input;
  const queries: string[] = [];
  if (ward && constituency && county) {
    queries.push(`${ward} ward, ${constituency}, ${county}, Kenya`);
    queries.push(`${ward}, ${constituency} constituency, ${county}, Kenya`);
  } else if (constituency && county) {
    queries.push(`${constituency} constituency, ${county}, Kenya`);
    queries.push(`${constituency}, ${county}, Kenya`);
  } else if (county) {
    queries.push(`${county} County, Kenya`);
    queries.push(`${county}, Kenya`);
  }
  return [...new Set(queries.map((query) => query.replace(/\s+/g, ' ').trim()))];
}

async function searchLocations(
  searchQuery: string,
  limit: number,
  options?: { preferArea?: boolean; areaNeedle?: string },
): Promise<GeocodeSuggestion[]> {
  const errors: string[] = [];
  let results: GeocodeSuggestion[] = [];

  try {
    results = await queryPhoton(searchQuery, limit);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Photon failed');
  }

  if (results.length === 0) {
    try {
      results = await queryNominatim(searchQuery, limit);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Nominatim failed');
    }
  } else if (results.length < limit) {
    try {
      const nominatimResults = await queryNominatim(searchQuery, limit);
      results = dedupeResults([...results, ...nominatimResults]).slice(0, limit);
    } catch {
      /* soft-fail */
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.join('; ') || 'Geocoding unavailable');
  }

  if (options?.preferArea && options.areaNeedle) {
    results = [...results].sort(
      (a, b) => scoreAreaResult(b, options.areaNeedle!) - scoreAreaResult(a, options.areaNeedle!),
    );
  }

  return dedupeResults(results).slice(0, limit);
}

export type GeocodeSearchResult = {
  results: GeocodeSuggestion[];
  degraded: boolean;
  error: string | null;
  reachable: boolean;
};

export async function searchLandmarkSuggestions(
  query: string,
  context: LandmarkLocationContext = {},
  signal?: AbortSignal,
): Promise<GeocodeSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { results: [], degraded: false, error: null, reachable: true };
  }

  const cacheKey = [
    trimmed.toLowerCase(),
    context.county?.trim().toLowerCase() || '',
    context.constituency?.trim().toLowerCase() || '',
    context.ward?.trim().toLowerCase() || '',
  ].join('|');
  const cached = suggestionCache.get(cacheKey);
  if (cached) {
    return { results: cached, degraded: false, error: null, reachable: true };
  }

  const queries = landmarkQueries(trimmed, context.county, context.constituency, context.ward);
  let lastError: string | null = null;

  for (const searchQuery of queries) {
    if (signal?.aborted) break;
    try {
      const results = await searchLocations(searchQuery, 8);
      if (results.length > 0) {
        suggestionCache.set(cacheKey, results);
        return { results, degraded: false, error: null, reachable: true };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Location search failed';
      await sleep(120);
    }
  }

  return {
    results: [],
    degraded: true,
    error: lastError
      ? /failed to fetch|networkerror|load failed|timeout|abort/i.test(lastError)
        ? 'Could not reach location search. Type the landmark and continue.'
        : lastError
      : 'No matching locations found. Type the landmark and continue.',
    reachable: !lastError || !/failed to fetch|networkerror|load failed|timeout|abort/i.test(lastError),
  };
}

export async function geocodeArea(
  context: LandmarkLocationContext,
  signal?: AbortSignal,
): Promise<GeocodeSearchResult> {
  if (!context.county?.trim()) {
    return { results: [], degraded: false, error: null, reachable: true };
  }
  const queries = areaQueries(context);
  const needle = context.ward || context.constituency || context.county || '';
  let lastError: string | null = null;

  for (const searchQuery of queries) {
    if (signal?.aborted) break;
    try {
      const results = await searchLocations(searchQuery, 5, {
        preferArea: true,
        areaNeedle: needle,
      });
      if (results.length > 0) {
        return { results: results.slice(0, 1), degraded: false, error: null, reachable: true };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Area search failed';
    }
  }

  return {
    results: [],
    degraded: Boolean(lastError),
    error: lastError,
    reachable: !lastError,
  };
}

/** Probe whether public geocoders answer (short timeout). Soft-fail → false. */
export async function probeGeocodeReachable(timeoutMs = 3500): Promise<boolean> {
  try {
    const url = new URL(PHOTON_URL);
    url.searchParams.set('q', 'Nairobi, Kenya');
    url.searchParams.set('limit', '1');
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    try {
      const url = new URL(NOMINATIM_URL);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'ke');
      url.searchParams.set('q', 'Nairobi');
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export function shortLandmarkLabel(label: string) {
  return label.split(',').slice(0, 3).join(', ').trim();
}

export function usableBounds(bounds?: GeocodeBoundingBox) {
  if (!bounds) return undefined;
  const latSpan = Math.abs(bounds.north - bounds.south);
  const lngSpan = Math.abs(bounds.east - bounds.west);
  if (latSpan < 0.02 && lngSpan < 0.02) return undefined;
  return bounds;
}

export function mapViewFromSuggestion(
  suggestion: GeocodeSuggestion,
  delta: number,
  options?: { preferDelta?: boolean },
): MapView {
  return {
    lat: suggestion.lat,
    lng: suggestion.lng,
    delta,
    bounds: options?.preferDelta ? undefined : usableBounds(suggestion.boundingBox),
    label: shortLandmarkLabel(suggestion.label),
  };
}

export function defaultMapView(): MapView {
  return { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, delta: ZOOM_DELTAS.default };
}

export function buildMapEmbedUrl(view: MapView) {
  const bbox =
    view.bounds != null
      ? [view.bounds.west, view.bounds.south, view.bounds.east, view.bounds.north].join('%2C')
      : [view.lng - view.delta, view.lat - view.delta, view.lng + view.delta, view.lat + view.delta].join(
          '%2C',
        );
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${view.lat}%2C${view.lng}`;
}

export function buildMapLink(view: MapView) {
  const zoom =
    view.delta >= 0.3 ? 9 : view.delta >= 0.1 ? 11 : view.delta >= 0.05 ? 13 : view.delta >= 0.02 ? 14 : 16;
  return `https://www.openstreetmap.org/?mlat=${view.lat}&mlon=${view.lng}#map=${zoom}/${view.lat}/${view.lng}`;
}
