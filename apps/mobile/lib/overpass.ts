import type { Coordinates, Peak } from '@peak/types';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: {
    name?: string;
    ele?: string;
    prominence?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassNode[];
}

/**
 * Fetch all named peaks from OpenStreetMap within `radiusKm` of `center`.
 *
 * No API key required. Uses the public Overpass API which is rate-limited but
 * sufficient for per-region fetches triggered only when the user moves >50 km.
 *
 * @throws {Error} on non-2xx HTTP status. Callers should handle and fall back
 *   to cached SQLite data.
 */
export async function fetchPeaksFromOverpass(
  center: Coordinates,
  radiusKm: number
): Promise<Peak[]> {
  const radiusMeters = radiusKm * 1000;

  // Overpass QL: all OSM nodes tagged natural=peak with a name within radius.
  // Timeout 25s matches the default Overpass server limit.
  const query = [
    '[out:json][timeout:25];',
    `node["natural"="peak"]["name"]`,
    `(around:${radiusMeters},${center.latitude},${center.longitude});`,
    'out;',
  ].join('');

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API returned ${response.status}`);
  }

  const data = (await response.json()) as OverpassResponse;

  return data.elements
    .filter((node): node is OverpassNode => node.type === 'node' && !!node.tags?.name)
    .map((node): Peak => {
      // OSM `ele` tag is a string and may contain units like "4392 m" or be absent.
      const rawEle = node.tags?.ele ?? '';
      const elevationMeters = parseFloat(rawEle);
      const elev = isNaN(elevationMeters) ? 0 : elevationMeters;

      // OSM `prominence` tag — meters of topographic prominence. Also a string.
      const rawProminence = node.tags?.prominence ?? '';
      const parsedProminence = parseFloat(rawProminence);
      const prominence = isNaN(parsedProminence) ? 0 : parsedProminence;

      return {
        id: `osm-${node.id}`,
        name: node.tags?.name ?? 'Unknown Peak',
        coordinates: {
          latitude: node.lat,
          longitude: node.lon,
          // Use parsed elevation as altitude so elevationAngle math works the
          // same way it did with the hardcoded PNW seed data.
          ...(elev > 0 ? { altitude: elev } : {}),
        },
        elevationMeters: elev,
        // OSM peak nodes don't carry a country tag — left blank until we add
        // reverse-geocoding or a country boundary lookup in Phase 3.
        country: '',
        osmId: String(node.id),
        ...(prominence > 0 ? { prominence } : {}),
      };
    });
}
