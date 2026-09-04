import * as SQLite from 'expo-sqlite';
import type { Coordinates, Peak } from '@peak/types';
import { distanceKm } from './bearing';

// Module-level singleton — openDatabase() is safe to call multiple times.
let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens (or returns the cached) peaks database and ensures the schema exists.
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  const db = await SQLite.openDatabaseAsync('peaks.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS peaks (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      latitude    REAL NOT NULL,
      longitude   REAL NOT NULL,
      altitude    REAL,
      elevation_m REAL,
      country     TEXT NOT NULL DEFAULT '',
      region      TEXT,
      prominence  REAL
    );

    CREATE INDEX IF NOT EXISTS idx_peaks_coords ON peaks (latitude, longitude);

    CREATE TABLE IF NOT EXISTS fetch_cache (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      latitude   REAL    NOT NULL,
      longitude  REAL    NOT NULL,
      fetched_at INTEGER NOT NULL
    );
  `);

  // Schema migrations — run after the CREATE TABLE so the table always exists.
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const schemaVersion = versionRow?.user_version ?? 0;

  if (schemaVersion < 1) {
    // v1: add prominence column. ALTER TABLE is a no-op if column already
    // exists on a fresh install, but we still need this for devices that
    // already had peaks.db without the column.
    try {
      await db.execAsync('ALTER TABLE peaks ADD COLUMN prominence REAL');
    } catch {
      // Column may already exist on fresh install from updated CREATE TABLE.
    }
    // Clear the fetch cache so the next launch re-fetches peaks with
    // prominence data populated.
    await db.execAsync('DELETE FROM fetch_cache');
    await db.execAsync('PRAGMA user_version = 1');
  }

  _db = db;
  return db;
}

/**
 * Upsert a batch of peaks inside an exclusive transaction.
 */
export async function upsertPeaks(
  db: SQLite.SQLiteDatabase,
  peaks: Peak[]
): Promise<void> {
  if (peaks.length === 0) return;

  await db.withExclusiveTransactionAsync(async (txn: SQLite.SQLiteDatabase) => {
    const stmt = await txn.prepareAsync(`
      INSERT OR REPLACE INTO peaks
        (id, name, latitude, longitude, altitude, elevation_m, country, region, prominence)
      VALUES
        ($id, $name, $lat, $lon, $alt, $elev, $country, $region, $prominence)
    `);
    try {
      for (const peak of peaks) {
        await stmt.executeAsync({
          $id: peak.id,
          $name: peak.name,
          $lat: peak.coordinates.latitude,
          $lon: peak.coordinates.longitude,
          $alt: peak.coordinates.altitude ?? null,
          $elev: peak.elevationMeters,
          $country: peak.country,
          $region: peak.region ?? null,
          $prominence: peak.prominence ?? null,
        });
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

interface DbPeakRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  elevation_m: number | null;
  country: string;
  region: string | null;
  prominence: number | null;
}

/**
 * Query peaks within a bounding box, then trim corners with Haversine.
 * The bounding box is cheap SQL; the Haversine removes ~22% false positives
 * at the corners of the box.
 */
export async function queryPeaksInBounds(
  db: SQLite.SQLiteDatabase,
  center: Coordinates,
  radiusKm: number
): Promise<Peak[]> {
  // Degrees per km varies by latitude for longitude but not latitude.
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((center.latitude * Math.PI) / 180));

  const rows = await db.getAllAsync<DbPeakRow>(
    `SELECT * FROM peaks
     WHERE latitude  BETWEEN ? AND ?
       AND longitude BETWEEN ? AND ?`,
    center.latitude - latDelta,
    center.latitude + latDelta,
    center.longitude - lonDelta,
    center.longitude + lonDelta
  );

  return rows
    .filter((row: DbPeakRow) => {
      const dist = distanceKm(center, { latitude: row.latitude, longitude: row.longitude });
      return dist <= radiusKm;
    })
    .map(
      (row: DbPeakRow): Peak => ({
        id: row.id,
        name: row.name,
        coordinates: {
          latitude: row.latitude,
          longitude: row.longitude,
          ...(row.altitude !== null ? { altitude: row.altitude } : {}),
        },
        elevationMeters: row.elevation_m ?? 0,
        country: row.country,
        ...(row.region !== null ? { region: row.region } : {}),
        ...(row.prominence !== null ? { prominence: row.prominence } : {}),
      })
    );
}

interface FetchCacheRow {
  latitude: number;
  longitude: number;
  fetched_at: number;
}

/**
 * Returns the last Overpass fetch center and timestamp, or null if never fetched.
 */
export async function getLastFetch(
  db: SQLite.SQLiteDatabase
): Promise<{ center: Coordinates; fetchedAt: number } | null> {
  const row = await db.getFirstAsync<FetchCacheRow>(
    'SELECT latitude, longitude, fetched_at FROM fetch_cache WHERE id = 1'
  );
  if (!row) return null;
  return {
    center: { latitude: row.latitude, longitude: row.longitude },
    fetchedAt: row.fetched_at,
  };
}

/**
 * Persist the fetch origin so we can skip re-fetching on the next cold start.
 */
export async function setLastFetch(
  db: SQLite.SQLiteDatabase,
  center: Coordinates
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO fetch_cache (id, latitude, longitude, fetched_at)
     VALUES (1, ?, ?, ?)`,
    center.latitude,
    center.longitude,
    Date.now()
  );
}
