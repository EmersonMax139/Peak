export interface Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface Peak {
  id: string;
  name: string;
  coordinates: Coordinates;
  elevationMeters: number;
  /** Two-letter country code */
  country: string;
  /** US state or equivalent region */
  region?: string;
  /** OSM node/way ID if sourced from OpenStreetMap */
  osmId?: string;
}

export interface DeviceOrientation {
  /** Compass heading in degrees (0 = north, 90 = east) */
  heading: number;
  /** Tilt from horizontal — positive = phone tilted up */
  pitch: number;
  /** Roll — how much phone is rotated on its long axis */
  roll: number;
  /** Whether heading is true north vs magnetic north */
  trueNorth: boolean;
}

export interface PeakCandidate extends Peak {
  /** Bearing from observer to peak in degrees */
  bearingDegrees: number;
  /** Vertical angle from observer to peak summit in degrees */
  elevationAngleDegrees: number;
  /** Straight-line distance in kilometers */
  distanceKm: number;
  /** How well the candidate matches current device orientation (0–1) */
  matchScore: number;
}

export interface PeakFinderState {
  status: 'locating' | 'scanning' | 'identified' | 'error';
  candidates: PeakCandidate[];
  topMatch: PeakCandidate | null;
  error?: string;
}
