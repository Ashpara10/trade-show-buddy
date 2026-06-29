import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-otto-accent active:opacity-90',
  secondary: 'border border-otto-border bg-otto-card active:bg-otto-card-hover',
  ghost: 'active:bg-otto-card-hover',
  danger: 'bg-otto-danger active:opacity-90',
};

const labelClasses: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-otto-text',
  ghost: 'text-otto-muted',
  danger: 'text-white',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={`flex-row items-center justify-center gap-3 rounded-2xl px-6 py-4 ${variantClasses[variant]} ${isDisabled ? 'opacity-50' : ''}`}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.text}
        />
      ) : (
        <>
          {icon}
          <Text className={`text-base font-semibold ${labelClasses[variant]}`}>{label}</Text>
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
