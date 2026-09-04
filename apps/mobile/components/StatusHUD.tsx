import { StyleSheet, View, Text } from 'react-native';
import { formatElevation } from '@/lib/format';

interface Props {
  locationAccuracy: number | null;
  elevation: number | null;
  heading: number | null;
  pitch: number | null;
  /** Whether heading is corrected to true north. Shows T/M indicator. */
  trueNorth: boolean;
}

function cardinalDirection(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(degrees / 45) % 8];
}

export function StatusHUD({ locationAccuracy, elevation, heading, pitch, trueNorth }: Props) {
  return (
    <View style={styles.hud} pointerEvents="none">
      {locationAccuracy !== null && (
        <Text style={styles.hudText}>
          GPS ±{Math.round(locationAccuracy)}m
        </Text>
      )}
      {elevation !== null && (
        <Text style={styles.hudText}>
          {formatElevation(elevation)} elev
        </Text>
      )}
      {heading !== null && (
        <Text style={styles.hudText}>
          {Math.round(heading)}° {cardinalDirection(heading)}{trueNorth ? ' T' : ' M'}
        </Text>
      )}
      {pitch !== null && (
        <Text style={styles.hudText}>
          {pitch >= 0 ? '+' : ''}
          {pitch.toFixed(1)}° tilt
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    top: 56,
    right: 16,
    gap: 4,
    alignItems: 'flex-end',
  },
  hudText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
