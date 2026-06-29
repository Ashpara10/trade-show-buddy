import { ReactNode } from 'react';
import { Text, View, ViewStyle } from 'react-native';

import { text } from '@/lib/theme';

// Reusable rounded-2xl card matching @tsb's "rounded-2xl border border-otto-border bg-otto-card".
export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      className={`rounded-2xl border border-otto-border bg-otto-card ${className}`}
      style={style}>
      {children}
    </View>
  );
}

export function Section({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className={text.labelAccent}>{label}</Text>
        {hint ? <Text className={text.smallMuted}>{hint}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

export function SkeletonSection({ label, hint }: { label: string; hint?: string }) {
  return (
    <Card className="p-5">
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className={text.labelAccent}>{label}</Text>
        {hint ? <Text className={text.smallMuted}>{hint}</Text> : null}
      </View>
      <View className="gap-2.5">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-row items-start gap-3">
            <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-otto-bg-soft">
              <Text className="text-[12px] font-semibold text-otto-muted">{i + 1}</Text>
            </View>
            <View className="h-4 flex-1 rounded bg-otto-bg-soft" />
          </View>
        ))}
      </View>
    </Card>
  );
}
