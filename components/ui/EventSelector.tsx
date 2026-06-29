import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

import { Button } from './Button';
import { useBottomSheet } from '@/components/BottomSheet';
import type { EventWithCount } from '@/lib/types';
import { colors } from '@/lib/theme';

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
      { title: 'Choose an event', snapPoints: ['50%', '80%'] }
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
      <View className="gap-3 p-2">
        <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-otto-muted">
          New event
        </Text>
        <TextInput
          autoFocus
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. SaaStock 2026"
          placeholderTextColor={colors.muted}
          maxLength={80}
          className="rounded-xl border border-otto-border bg-otto-bg px-4 py-2.5 text-sm text-otto-text focus:border-otto-accent"
        />
        {error ? <Text className="text-xs text-otto-danger">{error}</Text> : null}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              label={busy ? 'Adding…' : 'Add'}
              onPress={submitNew}
              loading={busy}
              disabled={!newName.trim()}
            />
          </View>
          <Pressable
            onPress={() => {
              setCreating(false);
              setNewName('');
              setError('');
            }}
            className="min-h-[52px] items-center justify-center rounded-2xl border border-otto-border bg-otto-card px-5">
            <Text className="text-sm text-otto-muted">Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <BottomSheetFlatList
      data={events}
      keyExtractor={(e) => e.id}
      ItemSeparatorComponent={() => <View className="h-px bg-otto-border" />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => onPick(item)}
          className={`flex-row items-center justify-between rounded-xl px-3 py-3 ${
            value === item.id ? 'bg-otto-accent-soft' : ''
          }`}>
          <Text
            className={`flex-1 text-base ${
              value === item.id ? 'font-semibold text-otto-accent' : 'text-otto-text'
            }`}
            numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            className={`shrink-0 text-xs tabular-nums ${
              value === item.id ? 'text-otto-accent' : 'text-otto-muted'
            }`}>
            {item.scan_count}
          </Text>
        </Pressable>
      )}
      ListFooterComponent={
        <View className="mt-2 border-t border-otto-border pt-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => setCreating(true)}
            className="flex-row items-center gap-2 rounded-xl px-3 py-3">
            <Text className="text-sm font-medium text-otto-accent">+</Text>
            <Text className="text-sm font-medium text-otto-accent">New event…</Text>
          </Pressable>
        </View>
      }
    />
  );
}
