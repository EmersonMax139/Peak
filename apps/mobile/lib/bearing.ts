import type { Coordinates } from '@peak/types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine distance between two GPS coordinates in kilometers.
 */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Initial bearing from `from` to `to` in degrees (0–360, clockwise from north).
 */
export function bearingDegrees(from: Coordinates, to: Coordinates): number {
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Vertical angle (elevation angle) in degrees from observer to target peak.
 * Positive = looking up, negative = looking down.
 */
export function elevationAngleDegrees(
  observer: Coordinates,
  target: Coordinates,
  distKm: number
): number {
  const observerAlt = observer.altitude ?? 0;
  const targetAlt = target.altitude ?? 0;
  const heightDiff = targetAlt - observerAlt;
  const horizontalM = distKm * 1000;
  return toDeg(Math.atan2(heightDiff, horizontalM));
}

/**
 * Angular difference between two bearings, accounting for wraparound.
 * Returns a value between 0 and 180.
 */
export function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
