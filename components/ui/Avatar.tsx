import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { getInitials } from '@/lib/utils';

type Props = {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: number;
};

// Mirrors @tsb/components/shared/Avatar.tsx. Rounded circle, lazy image
// with initials fallback. expo-image gives us disk + memory caching for
// remote URLs.
export function Avatar({ src, name, size = 44 }: Props) {
  const [errored, setErrored] = useState(false);
  const initials = getInitials(name);

  if (src && !errored) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e7e5e4' }}
        contentFit="cover"
        transition={120}
        onError={() => setErrored(true)}
        accessibilityLabel={name || 'Profile photo'}
      />
    );
  }

  return (
    <View
      accessibilityLabel={name || 'Profile'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
      className="items-center justify-center bg-otto-accent/15">
      <Text className="font-semibold text-otto-accent" style={{ fontSize: Math.floor(size * 0.4) }}>
        {initials || '?'}
      </Text>
    </View>
  );
}
