import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from '@peak/types';

export interface LocationState {
  coordinates: Coordinates | null;
  accuracy: number | null;
  permissionGranted: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    coordinates: null,
    accuracy: null,
    permissionGranted: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let removeSubscription: (() => void) | undefined;

    async function start() {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== Location.PermissionStatus.GRANTED) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          permissionGranted: false,
          error: 'Location permission denied. Peak identification requires GPS.',
        }));
        return;
      }

      setState((prev) => ({ ...prev, permissionGranted: true }));

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (location) => {
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            isLoading: false,
            coordinates: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude ?? undefined,
            },
            accuracy: location.coords.accuracy,
          }));
        }
      );

      if (cancelled) {
        subscription.remove();
        return;
      }

      removeSubscription = () => subscription.remove();
    }

    start();

    return () => {
      cancelled = true;
      removeSubscription?.();
    };
  }, []);

  return state;
}
