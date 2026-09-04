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
import { formatBearing, formatDistance, formatElevation } from '@/lib/format';
import type { PeakCandidate } from '@peak/types';

/**
 * Minimum topographic prominence to include a tagged peak in the Nearby list.
 * 300m (~1000 ft) filters out minor bumps and sub-peaks.
 */
const MIN_PROMINENCE_M = 300;

/**
 * Minimum elevation for peaks that have no prominence tag.
 * 1500m (~5000 ft) keeps proper mountains while hiding unnamed hillocks.
 */
const MIN_UNTAGGED_ELEVATION_M = 1500;

function isNotablePeak(peak: PeakCandidate): boolean {
  if (peak.prominence !== undefined) {
    return peak.prominence >= MIN_PROMINENCE_M;
  }
  return peak.elevationMeters >= MIN_UNTAGGED_ELEVATION_M;
}

export default function NearbyPeaksScreen() {
  const { status, error, allNearbyPeaks, isLoadingPeaks, coordinates } =
    usePeakFinder();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const notablePeaks = allNearbyPeaks.filter(isNotablePeak);
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
                <Text style={[styles.peakMeta, { color: colors.text + 'aa' }]}>
                  {[item.region, item.country].filter(Boolean).join(', ')}
                  {item.elevationMeters > 0
                    ? ` · ${formatElevation(item.elevationMeters)}`
                    : ''}
                  {item.prominence !== undefined
                    ? ` · ${Math.round(item.prominence)}m prom`
                    : ''}
                </Text>
              </View>
              <View style={styles.peakStats}>
                <Text style={[styles.distance, { color: colors.tint }]}>
                  {formatDistance(item.distanceKm)}
                </Text>
                <Text style={[styles.bearing, { color: colors.text + 'aa' }]}>
                  {formatBearing(item.bearingDegrees)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.subtext, { color: colors.text }]}>
              {error ?? (isLoadingPeaks ? 'Loading peaks…' : 'No peaks found nearby.')}
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
