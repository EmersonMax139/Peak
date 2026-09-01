import type {
  Coordinates,
  DeviceOrientation,
  Peak,
  PeakCandidate,
} from '@peak/types';
import {
  bearingDegrees,
  distanceKm,
  elevationAngleDegrees,
  angularDifference,
} from './bearing';

export interface PeakFinderOptions {
  /** Max search radius in km */
  radiusKm?: number;
  /** Max number of candidates to return */
  maxCandidates?: number;
  /** Angular tolerance in degrees for heading match */
  headingToleranceDeg?: number;
  /** Angular tolerance in degrees for pitch/elevation match */
  pitchToleranceDeg?: number;
}

const DEFAULTS: Required<PeakFinderOptions> = {
  radiusKm: 200,
  maxCandidates: 10,
  headingToleranceDeg: 15,
  pitchToleranceDeg: 10,
};

/**
 * Given observer position, device orientation, and a list of peaks,
 * returns ranked candidates that match what the camera is pointing at.
 */
export function findCandidatePeaks(
  observer: Coordinates,
  orientation: DeviceOrientation,
  peaks: Peak[],
  options: PeakFinderOptions = {}
): PeakCandidate[] {
  const opts = { ...DEFAULTS, ...options };

  const candidates: PeakCandidate[] = [];

  for (const peak of peaks) {
    const dist = distanceKm(observer, peak.coordinates);

    if (dist > opts.radiusKm) continue;

    const bearing = bearingDegrees(observer, peak.coordinates);
    const elevAngle = elevationAngleDegrees(
      observer,
      peak.coordinates,
      dist
    );

    const headingDiff = angularDifference(bearing, orientation.heading);
    const pitchDiff = Math.abs(elevAngle - orientation.pitch);

    // Only include peaks roughly in the direction the phone is pointing
    if (
      headingDiff > opts.headingToleranceDeg ||
      pitchDiff > opts.pitchToleranceDeg
    ) {
      continue;
    }

    // Score: 1.0 = perfect alignment, 0.0 = at tolerance boundary
    const headingScore = 1 - headingDiff / opts.headingToleranceDeg;
    const pitchScore = 1 - pitchDiff / opts.pitchToleranceDeg;
    // Weight heading more than pitch — compass error matters more than tilt error
    const matchScore = headingScore * 0.7 + pitchScore * 0.3;

    candidates.push({
      ...peak,
      bearingDegrees: bearing,
      elevationAngleDegrees: elevAngle,
      distanceKm: dist,
      matchScore,
    });
  }

  return candidates
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, opts.maxCandidates);
}
