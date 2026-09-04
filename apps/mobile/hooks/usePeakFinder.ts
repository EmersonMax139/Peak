import { useState, useEffect, useRef, useMemo } from 'react';
import type { Coordinates, Peak, PeakCandidate, PeakFinderState } from '@peak/types';
import { findCandidatePeaks } from '@/lib/peakFinder';
import { bearingDegrees, distanceKm, elevationAngleDegrees } from '@/lib/bearing';
import { useLocation } from './useLocation';
import { useCompass } from './useCompass';
import { usePeakDatabase, PEAK_SEARCH_RADIUS_KM } from './usePeakDatabase';

/**
 * If the user hasn't moved more than this distance from the last DB query
 * position, we skip re-querying SQLite. Avoids a DB read on every GPS tick.
 */
const RELOAD_DISTANCE_KM = 5;

export interface PeakFinderResult extends PeakFinderState {
  // Sensor data surfaced for UI without exposing internal hooks
  coordinates: Coordinates | null;
  locationAccuracy: number | null;
  heading: number | null;
  pitch: number | null;
  /** True when the heading is corrected to true north (declination applied). */
  trueNorth: boolean;
  permissionGranted: boolean;
  /**
   * All peaks within the search radius, sorted by distance — used by the
   * Nearby tab. Unlike `candidates`, these are not filtered by heading/pitch.
   * matchScore is 0 for all entries in this list.
   */
  allNearbyPeaks: PeakCandidate[];
  /** True while loading peaks from SQLite / Overpass on a new region. */
  isLoadingPeaks: boolean;
}

export function usePeakFinder(): PeakFinderResult {
  const location = useLocation();
  const compass = useCompass();
  const { isReady, getPeaksNear } = usePeakDatabase();

  const [state, setState] = useState<PeakFinderState>({
    status: 'locating',
    candidates: [],
    topMatch: null,
  });

  const [loadedPeaks, setLoadedPeaks] = useState<Peak[]>([]);
  const [isLoadingPeaks, setIsLoadingPeaks] = useState(false);

  // Track the coordinates at which we last loaded from the DB so we can
  // skip reloading when the GPS ticks but the user hasn't moved meaningfully.
  const lastLoadedCoordsRef = useRef<Coordinates | null>(null);

  // --- Load peaks from DB (and maybe Overpass) when region changes ---
  useEffect(() => {
    if (!isReady || !location.coordinates) return;

    // Skip if the user hasn't moved far enough to warrant a fresh DB read.
    if (lastLoadedCoordsRef.current) {
      const moved = distanceKm(lastLoadedCoordsRef.current, location.coordinates);
      if (moved < RELOAD_DISTANCE_KM) return;
    }

    let cancelled = false;
    lastLoadedCoordsRef.current = location.coordinates;

    async function loadPeaks() {
      if (!location.coordinates) return;
      setIsLoadingPeaks(true);
      try {
        const peaks = await getPeaksNear(location.coordinates, PEAK_SEARCH_RADIUS_KM);
        if (cancelled) return;
        setLoadedPeaks(peaks);
      } catch {
        // Silently keep whatever peaks were loaded before.
      } finally {
        if (!cancelled) setIsLoadingPeaks(false);
      }
    }

    loadPeaks();
    return () => {
      cancelled = true;
    };
  }, [isReady, location.coordinates, getPeaksNear]);

  // --- Match candidates whenever orientation or loaded peaks change ---
  useEffect(() => {
    if (location.error || compass.error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: location.error ?? compass.error ?? 'Unknown error',
      }));
      return;
    }

    if (location.isLoading || !location.coordinates) {
      setState((prev) => ({ ...prev, status: 'locating' }));
      return;
    }

    if (!compass.orientation) {
      setState((prev) => ({ ...prev, status: 'scanning' }));
      return;
    }

    const candidates = findCandidatePeaks(
      location.coordinates,
      compass.orientation,
      loadedPeaks
    );

    setState({
      status: candidates.length > 0 ? 'identified' : 'scanning',
      candidates,
      topMatch: candidates[0] ?? null,
    });
  }, [
    location.coordinates,
    location.isLoading,
    location.error,
    compass.orientation,
    compass.error,
    loadedPeaks,
  ]);

  // --- Compute all nearby peaks sorted by distance for the Nearby tab ---
  // Memoised so it only re-runs when the peaks list or position actually changes.
  const allNearbyPeaks = useMemo((): PeakCandidate[] => {
    if (!location.coordinates) return [];
    return loadedPeaks
      .map((peak): PeakCandidate => {
        const dist = distanceKm(location.coordinates!, peak.coordinates);
        const bearing = bearingDegrees(location.coordinates!, peak.coordinates);
        const elevAngle = elevationAngleDegrees(location.coordinates!, peak.coordinates, dist);
        return {
          ...peak,
          bearingDegrees: bearing,
          elevationAngleDegrees: elevAngle,
          distanceKm: dist,
          // 0 = not being pointed at; the candidates list has real scores.
          matchScore: 0,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [loadedPeaks, location.coordinates]);

  return {
    ...state,
    coordinates: location.coordinates,
    locationAccuracy: location.accuracy,
    heading: compass.orientation?.heading ?? null,
    pitch: compass.orientation?.pitch ?? null,
    trueNorth: compass.orientation?.trueNorth ?? false,
    permissionGranted: location.permissionGranted,
    allNearbyPeaks,
    isLoadingPeaks,
  };
}
