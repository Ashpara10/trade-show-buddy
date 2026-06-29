import { ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/utils';
import { colors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
};

// Per-variant default background (resting state) and pressed-state background.
// `null` means "use the className-only background" (e.g. transparent ghost).
// Pressed bg comes from CSS variables defined in global.css so the brand
// hover lives in one place.
const variantRest: Record<Variant, string> = {
  primary: 'bg-brand',
  secondary: 'border border-otto-border bg-otto-card',
  ghost: '',
  danger: 'bg-otto-danger',
};

const variantLabel: Record<Variant, string> = {
  primary: 'text-otto-text',
  secondary: 'text-otto-text',
  ghost: 'text-otto-muted',
  danger: 'text-white',
};

// Per-variant pressed-state background color (from global.css variables).
// Skipped for ghost (translucent overlay from `active:bg-otto-card-hover`).
const variantPressedBg: Record<Variant, string | null> = {
  primary: 'var(--color-brand-hover)',
  secondary: 'var(--color-otto-card-hover)',
  ghost: null,
  danger: 'var(--color-otto-accent-hover)',
};

// Per-variant disabled background. The `primary` variant stays in the
// brand family (just desaturated) so an off primary CTA still reads as
// a primary CTA — useful when users scan a list of disabled options and
// need to see "the Send button is unavailable" vs "a generic gray box".
// All other variants use the neutral disabled surface.
const variantDisabledBg: Record<Variant, string> = {
  primary: 'var(--color-brand-disabled)',
  secondary: 'var(--color-button-disabled-bg)',
  ghost: 'var(--color-button-disabled-bg)',
  danger: 'var(--color-button-disabled-bg)',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
}: Props) {
  const isDisabled = disabled || loading;
  const [pressed, setPressed] = useState(false);
  const pressedBg = variantPressedBg[variant];

  // While pressed (and not disabled), overlay the hover-tinted background
  // via inline style. This is the most reliable way to read a CSS variable
  // through NativeWind without generating a per-state class.
  const dynamicStyle =
    pressed && !isDisabled && pressedBg ? { backgroundColor: pressedBg } : undefined;

  // Disabled styling: per-variant disabled surface so primary stays in the
  // brand family, others fall back to neutral gray.
  const disabledStyle = isDisabled ? { backgroundColor: variantDisabledBg[variant] } : undefined;

  // The label text color flips to the disabled-text token when disabled.
  const labelClass = isDisabled ? 'text-otto-muted' : variantLabel[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      className={cn(
        'min-h-[52px] flex-row items-center  justify-center gap-2.5 rounded-2xl px-6 py-4',
        fullWidth && 'w-full',
        variantRest[variant],
        // Reduced-motion-friendly pressed state: opacity dip as a backup
        // (the inline backgroundColor swap above is the primary signal).
        pressed && !isDisabled && !pressedBg ? 'opacity-80' : null
      )}
      // style={dynamicStyle ?? disabledStyle}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.text}
        />
      ) : (
        <>
          {icon}
          <Text
            className={cn('text-[17px] font-semibold', labelClass)}
            style={isDisabled ? { color: 'var(--color-button-disabled-text)' } : undefined}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Spinner({ size = 'large' }: { size?: 'small' | 'large' }) {
  return (
    <View className="items-center justify-center">
      <ActivityIndicator size={size} color={colors.accent} />
    </View>
  );
}
