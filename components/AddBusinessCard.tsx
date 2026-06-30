import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { useUploadImage } from '@/lib/queries';
import { attachContactCard, resolveCard } from '@/lib/booth-client';
import { cn } from '@/lib/utils';

type Props = {
  interactionId: string;
  /** Called after a successful save so the parent can refetch images. */
  onSaved?: () => void;
  /** Override the label (e.g. "Replace business card"). */
  label?: string;
};

// Add/replace the business card for an existing interaction. Camera
// capture → resolveCard → attachContactCard + useUploadImage (React
// Query mutation, which invalidates the interaction detail key on
// success so the next read picks up the new image).
export function AddBusinessCard({ interactionId, onSaved, label }: Props) {
  const [busy, setBusy] = useState(false);
  const uploadImage = useUploadImage();

  async function capture() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access denied. Enable it in Settings → Apps.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = asset.base64;
      if (!base64) {
        Alert.alert('Could not read the captured photo.');
        return;
      }
      setBusy(true);
      const outcome = await resolveCard({
        images: [{ image: `data:${asset.mimeType || 'image/jpeg'};base64,${base64}` }],
      });
      if (
        !outcome.contact.name &&
        !outcome.contact.company &&
        outcome.contact.emails.length === 0 &&
        outcome.contact.phones.length === 0
      ) {
        Alert.alert("Couldn't read the card. Try again in good light.");
        return;
      }
      await attachContactCard({ interactionId, contactCard: outcome.contact });
      if (asset.uri) {
        // Non-blocking — failure here doesn't undo the contact-card
        // save. The mutation invalidates ['interaction', id] on
        // success, so the next read of the interaction detail
        // (via useInteractionDetail in scan.tsx or
        // ProspectDetailSheet) shows the new image.
        try {
          await uploadImage.mutateAsync({
            interactionId,
            uri: asset.uri,
            mime: asset.mimeType || 'image/jpeg',
          });
        } catch {
          /* non-critical */
        }
      }
      onSaved?.();
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : 'Could not read the card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={() => void capture()}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-xl bg-otto-accent px-5 py-3',
        'shadow-lg shadow-otto-accent/20 active:bg-otto-accent-hover disabled:opacity-50'
      )}>
      <CardIcon />
      <Text className="text-[17px] font-semibold text-white">
        {busy ? 'Saving…' : label ?? 'Add business card'}
      </Text>
    </Pressable>
  );
}

// Local card icon — View tree, not a Hugeicons component, so the
// button row stays compact. Mirrors the original AddBusinessCard in
// scan.tsx before it was extracted.
function CardIcon() {
  return (
    <View className="h-4 w-4">
      <View className="absolute inset-0 rounded-sm border border-current" />
      <View className="absolute left-1 top-1 h-1 w-1 rounded-full border border-current" />
      <View className="absolute left-2.5 right-1 top-1.5 h-px bg-current" />
      <View className="absolute left-2.5 right-2 top-2.5 h-px bg-current" />
    </View>
  );
}


