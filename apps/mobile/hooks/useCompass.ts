import { useState, useEffect, useRef } from 'react';
import { DeviceMotion } from 'expo-sensors';
import * as Location from 'expo-location';
import type { DeviceOrientation } from '@peak/types';

const SMOOTHING_FACTOR = 0.15;

// Circular smoothing to handle 0/360 wraparound without the needle snapping
function smoothAngle(current: number, previous: number, alpha: number): number {
  let diff = current - previous;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (previous + alpha * diff + 360) % 360;
}

export interface CompassState {
  orientation: DeviceOrientation | null;
  isAvailable: boolean;
  error: string | null;
}

export function useCompass() {
  const [state, setState] = useState<CompassState>({
    orientation: null,
    isAvailable: false,
    error: null,
  });

  const smoothedRef = useRef<DeviceOrientation | null>(null);

  // Latest heading from Location.watchHeadingAsync.
  // trueNorthRef tracks whether it's a true-north or magnetic-north value.
  const headingDegRef = useRef<number | null>(null);
  const isTrue = useRef<boolean>(false);

  // --- Heading subscription (true north via Location API) ---
  // This gives us declination-corrected true north when GPS is available,
  // falling back to magnetic north when it isn't.
  useEffect(() => {
    let cancelled = false;
    let headingSub: { remove: () => void } | null = null;

    async function startHeading() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== Location.PermissionStatus.GRANTED) return;

      headingSub = await Location.watchHeadingAsync((heading) => {
        if (cancelled) return;
        if (heading.trueHeading >= 0) {
          // True north is available — use it (magnetic declination applied by OS)
          headingDegRef.current = heading.trueHeading;
          isTrue.current = true;
        } else {
          // GPS not ready yet — use magnetic north as fallback
          headingDegRef.current = heading.magHeading;
          isTrue.current = false;
        }
      });
    }

    startHeading();
    return () => {
      cancelled = true;
      headingSub?.remove();
    };
  }, []);

  // --- DeviceMotion subscription (pitch + roll only) ---
  // We keep DeviceMotion running because it's the only source of tilt (pitch/roll).
  // For heading we prefer the Location API above; DeviceMotion alpha is only used
  // as a last resort when watchHeadingAsync hasn't produced a value yet.
  useEffect(() => {
    let cancelled = false;
    let subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;

    async function start() {
      const available = await DeviceMotion.isAvailableAsync();
      if (cancelled) return;

      if (!available) {
        setState((prev) => ({
          ...prev,
          error: 'Motion sensors unavailable on this device.',
        }));
        return;
      }

      setState((prev) => ({ ...prev, isAvailable: true }));
      DeviceMotion.setUpdateInterval(100);

      subscription = DeviceMotion.addListener((motion) => {
        if (cancelled || !motion.rotation) return;

        const { alpha, beta, gamma } = motion.rotation;

        // Heading: prefer the Location API value; fall back to DeviceMotion
        // alpha (magnetic, no declination) only while the heading API warms up.
        const rawHeading =
          headingDegRef.current !== null
            ? headingDegRef.current
            : ((alpha ?? 0) * (180 / Math.PI) + 360) % 360;

        const rawPitch = (beta ?? 0) * (180 / Math.PI);
        const rawRoll = (gamma ?? 0) * (180 / Math.PI);

        const prev = smoothedRef.current;
        const smoothed: DeviceOrientation = {
          heading: prev
            ? smoothAngle(rawHeading, prev.heading, SMOOTHING_FACTOR)
            : rawHeading,
          pitch: prev
            ? prev.pitch + SMOOTHING_FACTOR * (rawPitch - prev.pitch)
            : rawPitch,
          roll: prev
            ? prev.roll + SMOOTHING_FACTOR * (rawRoll - prev.roll)
            : rawRoll,
          trueNorth: isTrue.current,
        };

        smoothedRef.current = smoothed;
        setState((prev) => ({ ...prev, orientation: smoothed }));
      });
    }

    start();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return state;
}
