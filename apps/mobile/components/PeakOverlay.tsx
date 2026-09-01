import { StyleSheet, View, Text } from 'react-native';
import type { PeakCandidate } from '@peak/types';
import { formatDistance } from '@/lib/format';

interface Props {
  peak: PeakCandidate;
  candidates: PeakCandidate[];
}

function confidenceLabel(score: number): string {
  if (score >= 0.8) return 'High confidence';
  if (score >= 0.5) return 'Likely';
  return 'Possible match';
}

export function PeakOverlay({ peak, candidates }: Props) {
  const confidence = peak.matchScore;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.crosshairContainer}>
        <View style={styles.crosshairH} />
        <View style={styles.crosshairV} />
      </View>

      <View style={styles.labelContainer}>
        <Text style={styles.peakName}>{peak.name}</Text>
        <Text style={styles.peakMeta}>
          {peak.elevationMeters.toLocaleString()} m ·{' '}
          {formatDistance(peak.distanceKm)}
        </Text>
        <Text style={[styles.confidence, confidence >= 0.8 && styles.highConfidence]}>
          {confidenceLabel(confidence)}
        </Text>
      </View>

      {candidates.length > 1 && (
        <View style={styles.candidatesContainer}>
          <Text style={styles.candidatesTitle}>Also in view</Text>
          {candidates.slice(1, 4).map((c) => (
            <Text key={c.id} style={styles.candidateItem}>
              {c.name} · {formatDistance(c.distanceKm)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 100,
  },
  crosshairContainer: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    width: 60,
    height: 60,
    marginLeft: -30,
    marginTop: -30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  crosshairV: {
    position: 'absolute',
    width: 2,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  labelContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    maxWidth: '80%',
  },
  peakName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  peakMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
  },
  confidence: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  highConfidence: {
    color: '#4ade80',
  },
  candidatesContainer: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 12,
    marginRight: 16,
    marginBottom: 8,
    gap: 4,
    maxWidth: 200,
  },
  candidatesTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  candidateItem: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
});
