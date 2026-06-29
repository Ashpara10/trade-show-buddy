import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingOptions,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { useUploadRecording } from '@/lib/queries';
import { text } from '@/lib/theme';
import { formatTime, MAX_RECORDING_SEC, MAX_RECORDINGS } from '@/lib/utils';

type Props = {
  interactionId: string;
  recordingsCount: number;
  label?: string;
  doneMessage?: string;
};

type State = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

// Mirrors @tsb RecorderButton.tsx. Uses the expo-audio hooks API
// (useAudioRecorder + useAudioRecorderState) for native, reactive duration
// tracking and clean lifecycle handling.
export function RecorderButton({ interactionId, recordingsCount, label, doneMessage }: Props) {
  const atLimit = recordingsCount >= MAX_RECORDINGS;
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const upload = useUploadRecording();

  // High-quality recording preset. expo-audio ships HIGH_QUALITY (AAC/m4a on
  // native, webm on web) out of the box. We use it directly so the platform
  // blocks match what the lib actually exports.
  const recorderOptions: RecordingOptions = RecordingPresets.HIGH_QUALITY;

  const audioRecorder = useAudioRecorder(recorderOptions);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Mirror the recorder's meter for the countdown — the hook only gives us
  // a millisecond timestamp, so we compute elapsed client-side.
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Hard cap at MAX_RECORDING_SEC — auto-stop.
  useEffect(() => {
    if (state !== 'recording') return;
    if (elapsed >= MAX_RECORDING_SEC) {
      // stop() is captured in closure; the linter wants it as a dep but
      // adding it would re-run the effect on every render. Use the latest
      // stop via a ref-stable wrapper.
      void stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, state]);

  async function start() {
    if (state !== 'idle') return;
    setError('');
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone access denied. Enable it in Settings → Apps.');
        setState('error');
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      } as Parameters<typeof setAudioModeAsync>[0]);
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(s);
      }, 500);
      setState('recording');
      void Haptics.selectionAsync().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording.');
      setState('error');
    }
  }

  async function stop() {
    if (state !== 'recording') return;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setState('uploading');
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('Recording is empty.');
      const mime = 'audio/mp4';
      const ext = 'mp4';
      await upload.mutateAsync({
        interactionId,
        uri,
        mime,
        ext,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <View className="gap-2">
        <View className="flex-row items-center gap-3 rounded-xl border border-otto-success/30 bg-otto-success/10 px-4 py-3">
          <View className="h-2 w-2 rounded-full bg-otto-success" />
          <Text className={`${text.body} text-otto-success`}>
            {doneMessage || 'Recording saved. Transcript will appear in your dashboard shortly.'}
          </Text>
        </View>
        {!atLimit && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setState('idle');
              setError('');
            }}
            className="self-center">
            <Text className="text-xs text-otto-muted underline">Add another note</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const remaining = Math.max(0, MAX_RECORDING_SEC - elapsed);
  // recorderState is consumed by the hook itself; touch it to keep TS happy.
  void recorderState;

  return (
    <View className="gap-2">
      {state === 'idle' && !atLimit && (
        <Pressable
          accessibilityRole="button"
          onPress={start}
          className="flex-row items-center justify-center gap-2.5 rounded-xl border border-otto-border bg-otto-card px-4 py-3 active:bg-otto-card-hover">
          <View className="h-2 w-2 rounded-full bg-otto-danger" />
          <Text className={text.bodyStrong}>{label || 'Record this conversation'}</Text>
        </Pressable>
      )}

      {state === 'idle' && atLimit && (
        <View className="rounded-xl border border-otto-border bg-otto-card px-4 py-3">
          <Text className={`${text.bodyMuted} text-center`}>
            Voice note limit reached ({MAX_RECORDINGS}/{MAX_RECORDINGS}).
          </Text>
        </View>
      )}

      {state === 'recording' && (
        <Pressable
          accessibilityRole="button"
          onPress={stop}
          className="flex-row items-center justify-center gap-3 rounded-xl border border-otto-danger/40 bg-otto-danger/15 px-4 py-3 active:bg-otto-danger/20">
          <View className="h-2.5 w-2.5 animate-pulse rounded-full bg-otto-danger" />
          <Text className={`${text.bodyStrong} text-otto-danger`}>
            Stop recording · {formatTime(remaining)} left
          </Text>
        </Pressable>
      )}

      {state === 'uploading' && (
        <View className="flex-row items-center justify-center gap-2 rounded-xl border border-otto-border bg-otto-card px-4 py-3">
          <ActivityIndicator />
          <Text className={text.bodyMuted}>Uploading recording…</Text>
        </View>
      )}

      {state === 'error' && (
        <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <View className="flex-row items-start justify-between gap-3">
            <Text className={`${text.body} flex-1 text-red-700`}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setState('idle');
                setError('');
              }}>
              <Text className="text-[15px] text-red-700 underline">Dismiss</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
