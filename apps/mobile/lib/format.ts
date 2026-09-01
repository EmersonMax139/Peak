export function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatElevation(meters: number): string {
  return `${meters.toLocaleString()} m`;
}

export function formatBearing(degrees: number): string {
  return `${Math.round(degrees)}°`;
}
