import { Text, View } from 'react-native';

import type { AxisVerdict, Fitment } from '@/lib/types';

// A small pill-shaped chip used for fitment tags. Color tokens mirror
// @tsb's FitmentChip / AxisChip.
export function FitmentChip({ fitment }: { fitment: Fitment }) {
  const styles =
    fitment === 'ICP Match'
      ? 'bg-otto-accent-soft text-otto-accent border-otto-accent/30'
      : fitment === 'Partial Match'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-stone-100 text-stone-600 border-stone-200';
  const dot =
    fitment === 'ICP Match'
      ? 'bg-otto-accent'
      : fitment === 'Partial Match'
        ? 'bg-amber-500'
        : 'bg-stone-400';
  return (
    <View
      accessibilityLabel={`Fitment ${fitment}`}
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${styles}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <Text className="text-[12px] font-semibold">{fitment}</Text>
    </View>
  );
}

export function AxisChip({ label, verdict }: { label: string; verdict: AxisVerdict }) {
  const styles =
    verdict === 'Match'
      ? 'bg-otto-accent-soft text-otto-accent border-otto-accent/30'
      : verdict === 'Partial'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-stone-100 text-stone-600 border-stone-200';
  const dot =
    verdict === 'Match'
      ? 'bg-otto-accent'
      : verdict === 'Partial'
        ? 'bg-amber-500'
        : 'bg-stone-400';
  return (
    <View
      accessibilityLabel={`${label} ${verdict}`}
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${styles}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <Text className="text-[12px] font-medium text-otto-muted/80">{label}:</Text>
      <Text className="text-[12px] font-semibold">{verdict}</Text>
    </View>
  );
}

export function AxisSkeleton({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full border border-otto-border bg-otto-bg-soft px-2.5 py-1">
      <View className="h-1.5 w-1.5 rounded-full bg-otto-muted/40" />
      <Text className="text-[12px] text-otto-muted/80">{label}:</Text>
      <Text className="text-[12px] font-medium text-otto-muted">checking…</Text>
    </View>
  );
}
