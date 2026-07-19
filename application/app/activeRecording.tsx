import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import { ApiError, journalsApi, Mood } from '@/lib/api';

const GOLD = '#d4a017';
const PAGE_BG = '#0f0f1c';
const BUTTON_BG = '#222233';
const BAR_COUNT = 18;

export default function ActiveRecordingScreen() {
  const { mood: moodParam } = useLocalSearchParams<{ mood?: string }>();
  const mood = (moodParam as Mood) || 'Calm';

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 100);
  const stoppedRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    initRecording();
    return () => {
      if (!stoppedRef.current) {
        recorder.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  async function initRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Microphone access is required to record.');
        router.back();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      console.error('Failed to start recording', e);
      Alert.alert('Recording error', 'Could not access the microphone. Please try again.');
      router.back();
    }
  }

  async function finishRecording(): Promise<{ uri: string | null; durationMillis: number }> {
    if (stoppedRef.current) return { uri: recorder.uri ?? null, durationMillis: state.durationMillis };
    stoppedRef.current = true;
    const durationMillis = state.durationMillis;
    try {
      await recorder.stop();
    } catch (e) {
      console.error('Failed to stop recording', e);
    }
    return { uri: recorder.uri ?? null, durationMillis };
  }

  async function handleStop() {
    const { uri, durationMillis } = await finishRecording();

    if (!uri || durationMillis < 800) {
      Alert.alert('Recording too short', 'Please record a bit more before stopping.');
      router.back();
      return;
    }

    setIsProcessing(true);
    try {
      const journal = await journalsApi.createFromRecording({
        uri,
        mood,
        durationSeconds: durationMillis / 1000,
      });
      router.replace({ pathname: '/aiReflection', params: { id: journal._id } });
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : 'Failed to process your recording. Please try again.';
      Alert.alert('Something went wrong', message);
      setIsProcessing(false);
      router.back();
    }
  }

  async function handleClose() {
    await finishRecording();
    router.back();
  }

  const formatTime = (totalMillis: number) => {
    const totalSeconds = Math.floor(totalMillis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formattedSecs = secs < 10 ? `0${secs}` : secs;
    return `${mins} : ${formattedSecs.toString().split('').join(' ')}`;
  };

  const waveHeights = Array.from({ length: BAR_COUNT }, (_, i) => {
    const center = BAR_COUNT / 2;
    const dist = Math.abs(i - center) / center;
    const base = Math.max(6, 30 - dist * 25);
    const metering = state.metering ?? -60;
    const level = Math.max(0, (metering + 60) / 60);
    const variance = Math.random() * 20 * level;
    return Math.floor(base + variance);
  });

  if (isProcessing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.processingTitle}>Listening back to your thoughts…</Text>
          <Text style={styles.processingSubtitle}>
            Transcribing your entry and preparing a reflection
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.brandText}>Chronicle</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centerContainer}>
          <Text style={styles.statusText}>Recording... speak freely</Text>
          <Text style={styles.timerText}>{formatTime(state.durationMillis)}</Text>

          <View style={styles.rippleOuter}>
            <View style={styles.rippleMiddle}>
              <View style={styles.rippleInner}>
                <View style={styles.micButton}>
                  <Text style={styles.micIcon}>🎙</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.waveformContainer}>
            {waveHeights.map((height, index) => (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    height,
                    opacity: index < 3 || index > 14 ? 0.4 : 1,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.bottomContainer}>
          <TouchableOpacity style={styles.stopButton} onPress={handleStop} activeOpacity={0.8}>
            <View style={styles.stopSquare} />
            <Text style={styles.stopText}>STOP RECORDING</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  processingTitle: {
    fontSize: 20,
    fontStyle: 'italic',
    color: '#ffffff',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 13,
    color: '#8e8e9a',
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  brandText: {
    fontFamily: 'serif',
    fontSize: 24,
    color: '#8e8e9a',
    fontStyle: 'italic',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BUTTON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '300',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statusText: {
    fontSize: 28,
    fontStyle: 'italic',
    color: '#ffffff',
    fontFamily: 'serif',
    fontWeight: '300',
    marginBottom: 12,
  },
  timerText: {
    fontSize: 24,
    color: GOLD,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 40,
  },
  rippleOuter: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleMiddle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 0 },
    elevation: 15,
  },
  micIcon: {
    fontSize: 44,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 80,
    marginTop: 50,
    gap: 6,
  },
  waveBar: {
    width: 4,
    backgroundColor: GOLD,
    borderRadius: 2,
  },
  bottomContainer: {
    paddingHorizontal: 40,
    paddingBottom: 16,
    alignItems: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    backgroundColor: BUTTON_BG,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  stopSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#ff7675',
    borderRadius: 2,
  },
  stopText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
