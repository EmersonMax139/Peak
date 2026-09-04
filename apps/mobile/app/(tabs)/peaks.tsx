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
import { formatDistance, formatElevation } from '@/lib/format';
import type { PeakCandidate } from '@peak/types';

/**
 * Number of peaks to show in the Nearby list.
 * Sorted by elevation (tallest first), then re-sorted by distance for display.
 */
const MAX_NEARBY_PEAKS = 20;

function topNearbyPeaks(peaks: PeakCandidate[]): PeakCandidate[] {
  return [...peaks]
    .sort((a, b) => b.elevationMeters - a.elevationMeters)
    .slice(0, MAX_NEARBY_PEAKS)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export default function NearbyPeaksScreen() {
  const { status, error, allNearbyPeaks, isLoadingPeaks, coordinates } =
    usePeakFinder();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const notablePeaks = topNearbyPeaks(allNearbyPeaks);
  const isLocating = status === 'locating' && !coordinates;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLocating ? (
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={[styles.subtext, { color: colors.text }]}>
            Getting your location…
          </Text>
        </View>
      ) : (
        <FlatList
          data={notablePeaks}
          keyExtractor={(item: PeakCandidate) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headerRow}>
              <Text style={[styles.header, { color: colors.text }]}>Nearby Peaks</Text>
              {isLoadingPeaks && <ActivityIndicator size="small" />}
            </View>
          }
          renderItem={({ item }: { item: PeakCandidate }) => (
            <View style={[styles.peakCard, { borderColor: colors.text + '22' }]}>
              <View style={styles.peakMain}>
                <Text style={[styles.peakName, { color: colors.text }]}>
                  {item.name}
                </Text>
              </View>
              <View style={styles.peakStats}>
                <Text style={[styles.elevation, { color: colors.text, opacity: 0.6 }]}>
                  {item.elevationMeters > 0 ? formatElevation(item.elevationMeters) : '—'}
                </Text>
                <Text style={[styles.distance, { color: colors.tint }]}>
                  {formatDistance(item.distanceKm)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.subtext, { color: colors.text }]}>
              {error ?? (isLoadingPeaks
                ? 'Fetching peaks from OpenStreetMap…\nThis takes a few seconds on first load.'
                : 'No peaks found nearby.')}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
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
  peakStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  elevation: {
    fontSize: 13,
    fontWeight: '500',
  },
  distance: {
    fontSize: 16,
    fontWeight: '700',
  },
});
