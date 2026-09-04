# Peak — Phase 2 Build Guide

This document is written for a future LLM assistant (or human) picking up the project cold. It covers what exists, where the important decisions live, what to do next, and what to watch out for.

---

## What Is This App

Point your phone at a mountain. It tells you which peak it is.

Identification works by fusing GPS position + device compass/tilt to project a ray from the observer into the terrain, then matching that ray against a database of named peaks. A future layer adds visual silhouette matching using Digital Elevation Model (DEM) data to confirm or narrow results.

It is open source and free. There is no account, no subscription, no backend dependency for basic usage.

---

## Monorepo Structure

```
peak/
├── apps/
│   └── mobile/              # Expo (React Native) iOS + web app
├── packages/
│   └── types/               # Shared TypeScript interfaces
│       └── src/index.ts
├── docs/
│   └── phase-2.md           # This file
├── turbo.json               # Turborepo task config
├── pnpm-workspace.yaml      # pnpm workspace definition
└── package.json             # Root scripts
```

---

## Dev Setup

**Package manager: pnpm** (required — do not use npm or yarn).

```bash
pnpm install          # install all workspace deps
pnpm mobile           # start the Expo dev server
```

The `.npmrc` at the repo root sets `node-linker=hoisted` so pnpm hoists packages into a flat `node_modules` structure that Metro bundler can resolve without custom aliases.

**Expo SDK: 54** (Expo Go compatible — no custom dev client needed during development).

**Node: ≥24** (enforced via `.nvmrc` / `engines` field).

---

## Current Architecture (Phase 1 — Complete, Running on Device)

### Data flow

```
Device GPS chip  →  useLocation     ─┐
Device IMU chip  →  useCompass      ─┼→  usePeakFinder  →  UI screens
Hardcoded array  →  PNW_PEAKS       ─┘
```

### Key files and what they do

| File | Purpose |
|---|---|
| `apps/mobile/hooks/useLocation.ts` | Watches device GPS. Requests foreground permission, streams coordinates + accuracy. Race-condition-safe (cancelled flag pattern). |
| `apps/mobile/hooks/useCompass.ts` | Reads DeviceMotion from expo-sensors. Converts Euler angles (radians) to heading/pitch/roll (degrees). Applies exponential smoothing to prevent needle jitter. Race-condition-safe. |
| `apps/mobile/hooks/usePeakFinder.ts` | Composes location + compass into a single clean hook. **This is the only hook screens should import.** Internal hooks are not exposed. |
| `apps/mobile/lib/bearing.ts` | Pure math: Haversine distance, initial bearing, elevation angle, angular difference. No side effects. |
| `apps/mobile/lib/peakFinder.ts` | Takes observer position + device orientation + peak list → returns ranked `PeakCandidate[]`. Scoring weights heading 70% / pitch 30%. |
| `apps/mobile/lib/format.ts` | Shared formatting utilities: `formatDistance`, `formatElevation`, `formatBearing`. Always use these — never format inline in components. |
| `apps/mobile/data/peaks-pnw.ts` | **Temporary.** 12 hardcoded PNW peaks used as seed data. Replaced in Phase 2. |
| `packages/types/src/index.ts` | Source of truth for all shared types: `Peak`, `Coordinates`, `DeviceOrientation`, `PeakCandidate`, `PeakFinderState`. |

### Hook contract — `usePeakFinder`

```ts
interface PeakFinderResult {
  status: 'locating' | 'scanning' | 'identified' | 'error';
  candidates: PeakCandidate[];
  topMatch: PeakCandidate | null;
  error?: string;

  // Sensor data — screens use these directly, never reach into useLocation/useCompass
  coordinates: Coordinates | null;
  locationAccuracy: number | null;
  heading: number | null;
  pitch: number | null;
  permissionGranted: boolean;
}
```

Screens must only consume from this interface. If a screen needs new sensor data, add it to this return value — do not pass `useLocation` or `useCompass` directly to screens.

### Finder algorithm

1. Filter peaks outside `radiusKm` (default 200km)
2. Compute bearing and elevation angle from observer to each remaining peak
3. Filter peaks outside `headingToleranceDeg` (default ±15°) or `pitchToleranceDeg` (default ±10°)
4. Score remaining candidates: `headingScore * 0.7 + pitchScore * 0.3`
5. Sort by score descending, return top `maxCandidates` (default 10)

These tolerances are generous intentionally — they will need tuning once tested on a physical device in the field.

### Known limitations

**Compass accuracy:** `DeviceMotion` from expo-sensors reads Euler angles via CoreMotion on iOS. The `alpha` rotation component is used as compass heading. Heading accuracy depends on the device's magnetometer calibration and the CoreMotion reference frame. If heading is consistently off, the upgrade path is `Magnetometer` + `Gyroscope` fusion or a native Swift module wrapping `CMDeviceMotion` with an explicit reference frame. The `useCompass` interface is isolated enough that this is a drop-in replacement.

**Altitude:** GPS altitude has ~10–30m error. The elevation angle calculation uses it but it's not critical — heading is the primary discriminator.

**Data coverage:** Only 12 PNW peaks exist. The app will not find any peaks outside that region until Phase 2 is complete.

---

## Phase 2 — Real Peak Data ✅ Complete

### What was built

`data/peaks-pnw.ts` (12 hardcoded PNW peaks) has been deleted and replaced with a
live, regional, offline-capable peak database sourced from OpenStreetMap.

### Data source: OpenStreetMap Overpass API

Free, no API key required. Queries all named peaks within a bounding radius:

```
[out:json][timeout:25];
node["natural"="peak"]["name"](around:200000,{lat},{lon});
out;
```

Overpass endpoint: `https://overpass-api.de/api/interpreter`  
POST request, `Content-Type: application/x-www-form-urlencoded`, param `data=<query>`.

### Implemented files

**`lib/db.ts`** — SQLite singleton (WAL mode), schema init, bulk upsert via
`withExclusiveTransactionAsync`, bounding-box query + Haversine corner trim.

Key exports:
```ts
openDatabase(): Promise<SQLiteDatabase>
upsertPeaks(db, peaks): Promise<void>
queryPeaksInBounds(db, center, radiusKm): Promise<Peak[]>
getLastFetch(db): Promise<{ center: Coordinates; fetchedAt: number } | null>
setLastFetch(db, center): Promise<void>
```

Schema:
```sql
CREATE TABLE IF NOT EXISTS peaks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  altitude    REAL,
  elevation_m REAL,
  country     TEXT NOT NULL DEFAULT '',
  region      TEXT
);
CREATE INDEX IF NOT EXISTS idx_peaks_coords ON peaks (latitude, longitude);

CREATE TABLE IF NOT EXISTS fetch_cache (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  latitude   REAL    NOT NULL,
  longitude  REAL    NOT NULL,
  fetched_at INTEGER NOT NULL
);
```

**`lib/overpass.ts`** — POSTs the Overpass QL query, parses OSM nodes into `Peak[]`.
Handles missing/malformed `ele` tags (elevation defaults to 0). Sets
`coordinates.altitude` equal to `elevationMeters` so the elevation-angle math
works the same as it did with the hardcoded seed data.

**`hooks/usePeakDatabase.ts`** — opens the DB on mount, exposes a stable
`getPeaksNear(center, radiusKm)` function. Re-fetches from Overpass only when
the user has moved >50 km from the last fetch origin; all other reads are
instant SQLite queries with no network call.

```ts
export function usePeakDatabase(): {
  isReady: boolean;
  dbError: string | null;
  getPeaksNear: (center: Coordinates, radiusKm: number) => Promise<Peak[]>;
}
```

**`hooks/usePeakFinder.ts`** — updated to use `usePeakDatabase` instead of the
hardcoded array. Throttles DB reads to once per 5 km of movement (avoids a
SQLite query on every GPS tick). Also now exposes:

```ts
allNearbyPeaks: PeakCandidate[]  // all peaks in radius, sorted by distance (matchScore = 0)
isLoadingPeaks: boolean          // true while fetching from Overpass / SQLite
```

**`app/(tabs)/peaks.tsx`** — updated to consume `allNearbyPeaks` from
`usePeakFinder` instead of importing `PNW_PEAKS` directly. Shows a spinner in
the list header while `isLoadingPeaks` is true.

### Caching behaviour

| Situation | What happens |
|-----------|-------------|
| First launch in a new region | Overpass fetch (~1-3s), stored in SQLite |
| Relaunch same region | Instant SQLite read, no network |
| Moved >50 km | Background Overpass fetch, SQLite updated |
| No network | Falls back to whatever is already cached |

---

## Phase 3 — DEM Silhouette Matching

### Goal

Add a visual confirmation layer. GPS + compass gets you to the right neighborhood; silhouette matching picks the right peak when several are in frame.

### Concept

1. Fetch a DEM tile for the region around the observer
2. For each candidate peak, ray-cast from observer position through the terrain
3. Generate the expected horizon profile (skyline) as a 2D curve
4. Extract the horizon/ridgeline from the camera frame using edge detection
5. Match real edges against expected profiles — best match wins

### Data sources

- **US only:** USGS 3DEP — 1m / 3m / 10m resolution, free, no API key. Use 30m for filtering, 10m for confirmation.
- **Global:** SRTM (Shuttle Radar Topography Mission) — 30m, from NASA / OpenTopography.

### Tools to evaluate

- Pure geometry (ray casting) — preferred first approach, no model training required
- `@tensorflow/tfjs-react-native` — for silhouette comparison if going ML route
- `expo-gl` — if GPU-accelerated DEM rendering is needed

This phase is large. Design it separately before implementation.

---

## Phase 4 — EAS Build + App Store

1. Create account at [expo.dev](https://expo.dev)
2. `npx eas build:configure` in `apps/mobile`
3. `npx eas build --platform ios --profile preview` for a development build

Notes:
- `app.json` already has `bundleIdentifier: "com.peak.app"` and all permission strings configured
- `supportsTablet: false` is intentional — camera pointing behavior is portrait-only
- Apple Developer account ($99/year) required for App Store submission

---

## Coding Conventions

**Hooks are black boxes.** Internal hooks (`useLocation`, `useCompass`) are not exported to screens. Only `usePeakFinder` is the public API. If a screen needs new data, add it to `usePeakFinder`'s return value.

**Race-condition-safe async effects.** Any `useEffect` that does async setup uses the cancelled flag pattern:

```ts
useEffect(() => {
  let cancelled = false;
  async function start() {
    const result = await something();
    if (cancelled) return;
    // safe to setState here
  }
  start();
  return () => { cancelled = true; };
}, []);
```

**No TypeScript `any`.** The codebase has zero `any`s. Keep it that way.

**Formatting utilities live in `lib/format.ts`.** Never format distances, elevations, or bearings inline in components.

**Shared types live in `packages/types/src/index.ts`.** If a type is used in more than one file, it belongs there.

**Comments explain why, not what.** Comments only appear where the reasoning isn't obvious from the code itself.
