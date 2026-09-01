import { useState, useEffect, useRef } from 'react';
import { DeviceMotion } from 'expo-sensors';
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

        // Convert radians → degrees; normalize heading to 0–360
        const rawHeading = ((alpha ?? 0) * (180 / Math.PI) + 360) % 360;
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
          trueNorth: false,
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
