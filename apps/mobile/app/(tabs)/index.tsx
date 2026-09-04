import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { usePeakFinder } from '@/hooks/usePeakFinder';
import { PeakOverlay } from '@/components/PeakOverlay';
import { StatusHUD } from '@/components/StatusHUD';

export default function FinderScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const {
    status,
    topMatch,
    candidates,
    error,
    permissionGranted,
    locationAccuracy,
    coordinates,
    heading,
    pitch,
  } = usePeakFinder();

  if (!cameraPermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Camera access is required to identify peaks.
        </Text>
        <Text style={styles.errorLink} onPress={requestCameraPermission}>
          Grant camera access
        </Text>
      </View>
    );
  }

  const locationDenied = permissionGranted === false && status === 'error';

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />

      {topMatch && <PeakOverlay peak={topMatch} candidates={candidates} />}

      {status !== 'identified' && (
        <View style={styles.scanningOverlay}>
          {status === 'locating' && (
            <>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.scanningText}>Getting GPS fix…</Text>
            </>
          )}
          {status === 'scanning' && (
            <Text style={styles.scanningText}>Point at a mountain peak</Text>
          )}
          {locationDenied && (
            <Text style={styles.scanningText}>
              {error ?? 'Location access required.'}
            </Text>
          )}
        </View>
      )}

      <StatusHUD
        locationAccuracy={locationAccuracy}
        elevation={coordinates?.altitude ?? null}
        heading={heading}
        pitch={pitch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  scanningText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#000',
    gap: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorLink: {
    color: '#4ade80',
    fontSize: 15,
    fontWeight: '600',
  },
});
