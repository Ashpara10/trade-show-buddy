import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useBottomSheet } from './BottomSheet';
import { useEvents } from '@/lib/queries';
import { text } from '@/lib/theme';
import { pluralize } from '@/lib/utils';
import type { EventWithCount } from '@/lib/types';

type Props = {
  value: string | null; // null = "All events"
  onChange: (eventId: string | null) => void;
  totalScans: number;
};

// Mirror of @tsb EventFilter.tsx, but the picker uses the shared
// <BottomSheetProvider> via useBottomSheet() — no local <Modal>, no
// per-component state, no duplicated backdrop code. The same wrapper
// is used by the EventSelector on the scan screen.
export function EventFilter({ value, onChange, totalScans }: Props) {
  const sheet = useBottomSheet();
  const { data: events = [] } = useEvents();

  const selected = events.find((e) => e.id === value) || null;
  const triggerLabel = selected
    ? `${selected.name} (${selected.scan_count})`
    : `All events (${totalScans})`;

  // The list is rebuilt on every render — fine for a handful of events.
  // If the company ever crosses 100+ events we'd want useMemo + a useEffect
  // sync into sheet state, but the FlatList handles its own windowing.
  const items = useMemo(
    () => [{ id: null as string | null, name: 'All events', scan_count: totalScans }, ...events],
    [events, totalScans]
  );

  function open() {
    sheet.open(
      <EventPickerSheet
        items={items}
        value={value}
        onPick={(id) => {
          onChange(id);
          sheet.close();
        }}
      />,
      { title: 'Filter by event', snapPoints: ['50%', '80%'] }
    );
  }

  return (
    <View className="w-full">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter by event"
        onPress={open}
        className="flex-row items-center justify-between rounded-xl border border-otto-border bg-otto-card px-4 py-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Text className={text.smallMuted}>Event:</Text>
          <Text className={`${text.bodyStrong} flex-1`} numberOfLines={1}>
            {triggerLabel}
          </Text>
        </View>
        <Text className="ml-2 text-otto-muted">▾</Text>
      </Pressable>
    </View>
  );
}

// ─── The sheet body ──────────────────────────────────────────────────────────
// Kept as a separate component so the body can be self-contained: no
// `useEvents` re-query, no provider lookups, no re-render churn on the
// dashboard while the user is scrolling. Renders the same row layout
// EventFilter used to render inline.

type Item = { id: string | null; name: string; scan_count: number };

function EventPickerSheet({
  items,
  value,
  onPick,
}: {
  items: Item[];
  value: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <View className="flex-1">
      <FlatList
        data={items}
        keyExtractor={(e) => e.id || 'all'}
        ItemSeparatorComponent={() => <View className="h-px bg-otto-border" />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onPick(item.id)}
            className={`flex-row items-center justify-between rounded-xl px-2 py-3 ${
              value === item.id ? 'bg-otto-accent-soft' : ''
            }`}>
            <Text
              className={`flex-1 ${text.body} ${
                value === item.id ? 'font-semibold text-otto-accent' : 'text-otto-text'
              }`}
              numberOfLines={1}>
              {item.name}
            </Text>
            <Text
              className={`text-xs tabular-nums ${
                value === item.id ? 'text-otto-accent' : 'text-otto-muted'
              }`}>
              {pluralize(item.scan_count, 'scan', 'scans')}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
