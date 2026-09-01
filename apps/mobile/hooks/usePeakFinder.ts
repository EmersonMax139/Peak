import { useState, useEffect } from 'react';
import type { Coordinates, PeakFinderState } from '@peak/types';
import { findCandidatePeaks } from '@/lib/peakFinder';
import { useLocation } from './useLocation';
import { useCompass } from './useCompass';
import { PNW_PEAKS } from '@/data/peaks-pnw';

export interface PeakFinderResult extends PeakFinderState {
  // Sensor data surfaced for UI without exposing internal hooks
  coordinates: Coordinates | null;
  locationAccuracy: number | null;
  heading: number | null;
  pitch: number | null;
  permissionGranted: boolean;
}

export function usePeakFinder(): PeakFinderResult {
  const location = useLocation();
  const compass = useCompass();

  const [state, setState] = useState<PeakFinderState>({
    status: 'locating',
    candidates: [],
    topMatch: null,
  });

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
      PNW_PEAKS
    );

    setState({
      status: candidates.length > 0 ? 'identified' : 'scanning',
      candidates,
      topMatch: candidates[0] ?? null,
    });
  }, [location.coordinates, location.isLoading, location.error, compass.orientation, compass.error]);

  return {
    ...state,
    coordinates: location.coordinates,
    locationAccuracy: location.accuracy,
    heading: compass.orientation?.heading ?? null,
    pitch: compass.orientation?.pitch ?? null,
    permissionGranted: location.permissionGranted,
  };
}
