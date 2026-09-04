import { useState, useEffect, useRef, useCallback } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Coordinates, Peak } from '@peak/types';
import {
  openDatabase,
  upsertPeaks,
  queryPeaksInBounds,
  getLastFetch,
  setLastFetch,
} from '@/lib/db';
import { fetchPeaksFromOverpass } from '@/lib/overpass';
import { distanceKm } from '@/lib/bearing';

/**
 * If the user has moved more than this distance from the last Overpass fetch
 * origin, we fetch a fresh batch of peaks. 50 km means we stay well within
 * the 200 km query radius even near the edges.
 */
const REFETCH_DISTANCE_KM = 50;

/** Search radius sent to both Overpass and the SQLite bounding-box query. */
export const PEAK_SEARCH_RADIUS_KM = 200;

export interface PeakDatabaseResult {
  /** True once the SQLite database has been opened and is ready to query. */
  isReady: boolean;
  /** Set if the database could not be opened. */
  dbError: string | null;
  /**
   * Returns peaks within `radiusKm` of `center`.
   * On first call (or after moving >50 km) it fetches from Overpass and
   * caches the results; subsequent calls are instant SQLite reads.
   */
  getPeaksNear: (center: Coordinates, radiusKm: number) => Promise<Peak[]>;
}

export function usePeakDatabase(): PeakDatabaseResult {
  const [isReady, setIsReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const dbRef = useRef<SQLiteDatabase | null>(null);

  // Open the database once on mount.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const db = await openDatabase();
        if (cancelled) return;
        dbRef.current = db;
        setIsReady(true);
      } catch (err) {
        if (cancelled) return;
        setDbError(err instanceof Error ? err.message : 'Failed to open database');
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Stable reference — reads from dbRef so it never needs to be recreated.
   * Safe to list as a dependency in useEffect without causing infinite loops.
   */
  const getPeaksNear = useCallback(
    async (center: Coordinates, radiusKm: number): Promise<Peak[]> => {
      const db = dbRef.current;
      if (!db) return [];

      const lastFetch = await getLastFetch(db);
      const movedFar =
        !lastFetch || distanceKm(lastFetch.center, center) > REFETCH_DISTANCE_KM;

      if (movedFar) {
        try {
          const freshPeaks = await fetchPeaksFromOverpass(center, PEAK_SEARCH_RADIUS_KM);
          await upsertPeaks(db, freshPeaks);
          await setLastFetch(db, center);
        } catch {
          // Network unavailable — fall through to whatever is already in SQLite.
          // The app works offline as long as the user has visited the region before.
        }
      }

      return queryPeaksInBounds(db, center, radiusKm);
    },
    [] // stable — reads from ref, not state
  );

  return { isReady, dbError, getPeaksNear };
}
