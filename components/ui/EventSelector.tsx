import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useBottomSheet } from '@/components/BottomSheet';
import { colors } from '@/lib/theme';
import type { EventWithCount } from '@/lib/types';
import { ArrowLeft02Icon, X } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';

type Props = {
  events: EventWithCount[];
  value: string | null;
  onChange: (event: { id: string; name: string }) => void;
  onCreate: (name: string) => Promise<{ id: string; name: string } | null>;
};

// Custom branded dropdown + inline create flow. Uses the shared
// <BottomSheetProvider> via useBottomSheet() — no local <Modal>, no
// duplicated backdrop code. Mirrors @tsb/components/scan/EventSelector.tsx
// visually + behaviourally. The trigger is the card around the picker
// pill; tapping it opens the sheet. Sheet body is implemented as a
// separate component below so the parent (this one) stays stateless.
export function EventSelector({ events, value, onChange, onCreate }: Props) {
  const sheet = useBottomSheet();

  const selected = events.find((e) => e.id === value) || null;
  const triggerLabel = selected
    ? `${selected.name} (${selected.scan_count})`
    : events.length === 0
      ? 'Loading events…'
      : 'Select an event';

  function open() {
    sheet.open(
      <EventSelectorSheet
        events={events}
        value={value}
        onPick={(e) => {
          onChange({ id: e.id, name: e.name });
          sheet.close();
        }}
        onCreate={async (name) => {
          const created = await onCreate(name);
          if (created) {
            onChange(created);
            sheet.close();
          }
          return created;
        }}
      />,
      { snapPoints: ['50%', '80%'] }
    );
  }

  return (
    <View className="mb-5 rounded-2xl border border-otto-border bg-otto-card p-4">
      <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-otto-accent">
        Choose an event
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose an event"
        onPress={open}
        className="mt-2 flex-row items-center justify-between rounded-xl border border-otto-border bg-otto-bg px-4 py-2.5">
        <Text className="flex-1 text-sm font-medium text-otto-text" numberOfLines={1}>
          {triggerLabel}
        </Text>
        <Text className="ml-2 text-otto-muted">▾</Text>
      </Pressable>

      {selected && (
        <Text className="mt-2 text-xs text-otto-muted">
          Tagging new scans to <Text className="font-medium text-otto-text">{selected.name}</Text>
        </Text>
      )}
    </View>
  );
}

// ─── Sheet body ──────────────────────────────────────────────────────────────
// Self-contained: manages its own "creating new event" sub-flow + busy
// state. Doesn't reach back to the parent except via the callbacks passed
// in. This keeps the sheet content independent — the dashboard picker
// and the scan picker can each have their own internal state without
// conflicting.

function EventSelectorSheet({
  events,
  value,
  onPick,
  onCreate,
}: {
  events: EventWithCount[];
  value: string | null;
  onPick: (e: EventWithCount) => void;
  onCreate: (name: string) => Promise<{ id: string; name: string } | null>;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submitNew() {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    setBusy(true);
    setError('');
    const created = await onCreate(name);
    setBusy(false);
    if (!created) {
      setError('Could not create event.');
    }
    // On success, the parent already called sheet.close().
  }

  if (creating) {
    return (
      <View className="gap-3 p-2 mt-6">
        <View className="flex-row mb-2 relative items-center justify-between gap-2">
          <Text className="text-xl font-semibold text-otto-text">Create new event</Text>
          <Pressable
            onPress={() => {
              setCreating(false);
              setNewName('');
              setError('');
            }}
            className="flex items-center justify-center size-8  rounded-full bg-neutral-200/60 ">
            <HugeiconsIcon className='size-5' icon={X} strokeWidth={1.8} />
          </Pressable>
        </View>
        <TextInput
          autoFocus
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. SaaStock 2026"
          placeholderTextColor={colors.muted}
          maxLength={80}
          className="rounded-xl border border-otto-border bg-otto-bg px-4 py-2.5 text-lg text-otto-text focus:border-otto-accent"
        />
        {error ? <Text className="text-base text-otto-danger">{error}</Text> : null}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Pressable
              onPress={submitNew}
              disabled={!newName.trim()}
              className="py-4 w-full items-center justify-center rounded-2xl bg-otto-accent"
            >
              <Text className="text-lg font-semibold text-white">Add event</Text>
            </Pressable>
          </View>

        </View>
      </View>
    );
  }

  return (
    // The parent <BottomSheetModal> already wraps its content in a
    // <BottomSheetScrollView>, so a virtualised list (FlatList) here would
    // trip RN's "VirtualizedLists nested in plain ScrollViews" warning and
    // break windowing. We render a plain <ScrollView> instead — event lists
    // are small (typically <20 items at a trade show) so the lack of
    // virtualisation is fine and the sheet handles the scrolling.
    <ScrollView
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled">
      {events.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onPick(item)}
          className={`flex-row items-center justify-between rounded-xl px-3 py-3 ${value === item.id ? 'bg-otto-accent-soft' : ''
            }`}>
          <Text
            className={`flex-1 text-base ${value === item.id ? 'font-semibold text-otto-accent' : 'text-otto-text'
              }`}
            numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            className={`shrink-0 text-sm tabular-nums ${value === item.id ? 'text-otto-accent' : 'text-otto-muted'
              }`}>
            {item.scan_count}
          </Text>
        </Pressable>
      ))}
      <View className="h-px mt-2 bg-otto-border" />
      <View className="mt-2 ">
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreating(true)}
          className="flex-row items-center gap-2 rounded-xl px-3 py-3">
          <Text className="text-sm font-medium text-otto-accent">+</Text>
          <Text className="text-sm font-medium text-otto-accent">New event…</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
