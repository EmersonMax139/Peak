import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { usePeakFinder } from '@/hooks/usePeakFinder';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { PNW_PEAKS } from '@/data/peaks-pnw';
import { bearingDegrees, distanceKm, elevationAngleDegrees } from '@/lib/bearing';
import { formatBearing, formatDistance, formatElevation } from '@/lib/format';
import type { Peak } from '@peak/types';

export default function NearbyPeaksScreen() {
  const { coordinates, status, error } = usePeakFinder();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const nearbyPeaks = coordinates
    ? PNW_PEAKS.map((peak: Peak) => {
        const dist = distanceKm(coordinates, peak.coordinates);
        const bearing = bearingDegrees(coordinates, peak.coordinates);
        const elevAngle = elevationAngleDegrees(coordinates, peak.coordinates, dist);
        return { peak, dist, bearing, elevAngle };
      }).sort((a, b) => a.dist - b.dist)
    : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {status === 'locating' && !coordinates ? (
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={[styles.subtext, { color: colors.text }]}>
            Getting your location…
          </Text>
        </View>
      ) : (
        <FlatList
          data={nearbyPeaks}
          keyExtractor={(item) => item.peak.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[styles.header, { color: colors.text }]}>Nearby Peaks</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.peakCard, { borderColor: colors.text + '22' }]}>
              <View style={styles.peakMain}>
                <Text style={[styles.peakName, { color: colors.text }]}>
                  {item.peak.name}
                </Text>
                <Text style={[styles.peakMeta, { color: colors.text + 'aa' }]}>
                  {item.peak.region}, {item.peak.country} · {formatElevation(item.peak.elevationMeters)}
                </Text>
              </View>
              <View style={styles.peakStats}>
                <Text style={[styles.distance, { color: colors.tint }]}>
                  {formatDistance(item.dist)}
                </Text>
                <Text style={[styles.bearing, { color: colors.text + 'aa' }]}>
                  {formatBearing(item.bearing)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.subtext, { color: colors.text }]}>
              {error ?? 'No peaks found nearby.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
    padding: 24,
  },
  peakCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  peakMain: {
    flex: 1,
    gap: 2,
  },
  peakName: {
    fontSize: 17,
    fontWeight: '600',
  },
  peakMeta: {
    fontSize: 13,
  },
  peakStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  distance: {
    fontSize: 16,
    fontWeight: '700',
  },
  bearing: {
    fontSize: 13,
  },
});
