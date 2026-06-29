import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';

import { useEvents, useSetInteractionEvent } from '@/lib/queries';
import { text } from '@/lib/theme';
import { pluralize } from '@/lib/utils';

type Props = {
  interactionId: string;
  eventId: string | null;
  eventName: string | null;
};

// "Where we met: <event>" with tap-to-edit. Mirror of @tsb EventTag.tsx —
// opens a modal list of the company's events; selecting one POSTs the change
// to /api/interaction/[id]/event.
export function EventTag({ interactionId, eventId, eventName }: Props) {
  const [editing, setEditing] = useState(false);
  const { data: events = [] } = useEvents();
  const mutation = useSetInteractionEvent();

  useEffect(() => {
    if (!editing) mutation.reset();
  }, [editing, mutation]);

  async function pick(newId: string) {
    try {
      await mutation.mutateAsync({ interactionId, eventId: newId });
      setEditing(false);
    } catch {
      /* error is shown below */
    }
  }

  const display = eventName || 'General Networking';

  return (
    <View className="gap-1">
      <Text className={text.label}>Where we met</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change event"
        onPress={() => setEditing(true)}
        className="flex-row items-center gap-2 self-start rounded-xl border border-otto-border bg-otto-bg px-3 py-2">
        <Text className="text-base">📍</Text>
        <Text className={text.bodyStrong}>{display}</Text>
        <Text className="text-otto-muted">▾</Text>
      </Pressable>

      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setEditing(false)}>
          <Pressable
            className="mx-5 mt-32 max-h-[60%] rounded-2xl border border-otto-border bg-otto-card p-3"
            onPress={() => {
              /* swallow */
            }}>
            <Text className={`${text.label} px-2 pb-2`}>Pick event</Text>
            <FlatList
              data={events}
              keyExtractor={(e) => e.id}
              ItemSeparatorComponent={() => <View className="h-px bg-otto-border" />}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => pick(item.id)}
                  disabled={mutation.isPending}
                  className={`flex-row items-center justify-between rounded-xl px-3 py-3 ${
                    eventId === item.id ? 'bg-otto-accent-soft' : ''
                  }`}>
                  <Text
                    className={`flex-1 ${text.body} ${
                      eventId === item.id ? 'font-semibold text-otto-accent' : 'text-otto-text'
                    }`}
                    numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text
                    className={`text-xs tabular-nums ${
                      eventId === item.id ? 'text-otto-accent' : 'text-otto-muted'
                    }`}>
                    {pluralize(item.scan_count, 'scan', 'scans')}
                  </Text>
                </Pressable>
              )}
            />
            {mutation.isError && (
              <Text className="px-3 py-2 text-sm text-otto-danger">Could not update event.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
