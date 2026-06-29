import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import { Card } from './ui/Card';
import { useDeleteImage, useUploadImage } from '@/lib/queries';
import { text } from '@/lib/theme';
import { MAX_IMAGES } from '@/lib/utils';
import type { ProspectImage } from '@/lib/types';

type Props = {
  interactionId: string;
  images: ProspectImage[];
};

type State = 'idle' | 'uploading' | 'error';

// Mirror of @tsb ProspectImagePicker.tsx — camera or library picker, uploads
// JPEG, deletes via the matching API route.
export function ProspectImagePicker({ interactionId, images }: Props) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const upload = useUploadImage();
  const del = useDeleteImage();
  const atLimit = images.length >= MAX_IMAGES;

  async function pickImage(source: 'camera' | 'library') {
    setError('');
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Camera access denied. Enable it in Settings → Apps.');
          setState('error');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        exif: false,
        ...(source === 'camera' ? { cameraType: ImagePicker.CameraType.back } : {}),
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setState('uploading');
      await upload.mutateAsync({
        interactionId,
        uri: asset.uri,
        mime: asset.mimeType || 'image/jpeg',
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setState('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
      setState('error');
    }
  }

  function confirmDelete(url: string) {
    Alert.alert('Delete this photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          del.mutate({ interactionId, url });
        },
      },
    ]);
  }

  return (
    <Card className="gap-3 p-5">
      <View className="flex-row items-baseline justify-between">
        <Text className={text.labelAccent}>Photos</Text>
        <Text className="text-xs italic text-otto-muted">
          {images.length}/{MAX_IMAGES} photos
        </Text>
      </View>

      {images.length === 0 && state !== 'uploading' && (
        <Text className="text-[15px] italic text-otto-muted">
          No photos yet. Tap below to take one.
        </Text>
      )}

      {images.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {images.map((img) => (
            <View
              key={img.url}
              className="relative aspect-square w-[31%] overflow-hidden rounded-lg border border-otto-border bg-otto-bg-soft">
              <Image
                source={{ uri: img.url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={120}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
                onPress={() => confirmDelete(img.url)}
                className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/55">
                <Text className="text-base leading-none text-white">×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {state === 'idle' && !atLimit && (
        <View className="gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => pickImage('camera')}
            className="flex-row items-center justify-center gap-2.5 rounded-xl border border-otto-border bg-otto-card px-4 py-3 active:bg-otto-card-hover">
            <Text className={text.bodyStrong}>+ Take a photo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => pickImage('library')}
            className="flex-row items-center justify-center gap-2.5 rounded-xl border border-otto-border bg-otto-card px-4 py-3 active:bg-otto-card-hover">
            <Text className={text.bodyStrong}>📁 Choose from library</Text>
          </Pressable>
        </View>
      )}

      {state === 'idle' && atLimit && (
        <View className="rounded-xl border border-otto-border bg-otto-card px-4 py-3">
          <Text className={`${text.bodyMuted} text-center`}>
            Photo limit reached ({MAX_IMAGES}/{MAX_IMAGES}).
          </Text>
        </View>
      )}

      {state === 'uploading' && (
        <View className="flex-row items-center justify-center gap-2 rounded-xl border border-otto-border bg-otto-card px-4 py-3">
          <ActivityIndicator />
          <Text className={text.bodyMuted}>Uploading photo…</Text>
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
    </Card>
  );
}
