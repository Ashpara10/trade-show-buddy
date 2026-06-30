import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Fuse from 'fuse.js';

import { Spinner } from '@/components/ui/Button';
import { DashboardSearch } from '@/components/DashboardSearch';
import { DashboardTable } from '@/components/DashboardTable';
import { useBottomSheet } from '@/components/BottomSheet';
import { useDashboard, useEvents } from '@/lib/queries';
import { fetchDashboardCsv } from '@/lib/booth-client';
import { useSession } from '@/components/SessionContext';
import { colors, text } from '@/lib/theme';
import { pluralize } from '@/lib/utils';

export default function DashboardScreen() {
  const router = useRouter();
  const { session, authChecked } = useSession();
  const { data, isLoading, error, refetch, isRefetching } = useDashboard();
  const { data: events = [] } = useEvents();
  const sheet = useBottomSheet();
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (authChecked && !session) router.replace('/' as never);
  }, [authChecked, session, router]);

  const eventFiltered = useMemo(() => {
    if (!data) return [];
    if (!eventFilter) return data.rows;
    return data.rows.filter((r) => r.event_id === eventFilter);
  }, [data, eventFilter]);

  const fuse = useMemo(() => {
    if (eventFiltered.length === 0) return null;
    return new Fuse(eventFiltered, {
      keys: ['prospect_name', 'prospect_company', 'prospect_role'],
      threshold: 0.4,
      ignoreLocation: true,
    });
  }, [eventFiltered]);

  const filteredRows = useMemo(() => {
    const q = query.trim();
    if (!q || !fuse) return eventFiltered;
    return fuse.search(q).map((r) => r.item);
  }, [eventFiltered, query, fuse]);

  const stats = useMemo(() => {
    if (!data) return { totalScans: 0, uniqueProspects: 0 };
    if (!eventFilter) {
      return { totalScans: data.totalScans, uniqueProspects: data.uniqueProspects };
    }
    const unique = new Set(eventFiltered.map((r) => r.linkedin_url)).size;
    return { totalScans: eventFiltered.length, uniqueProspects: unique };
  }, [data, eventFilter, eventFiltered]);

  const showExport = !!(data && data.uniqueProspects > 0);
  const showFilter = !!(data && data.rows.length > 0);

  const selectedEvent = events.find((e) => e.id === eventFilter) || null;
  const triggerLabel = selectedEvent
    ? `${selectedEvent.name} (${selectedEvent.scan_count})`
    : `All events (${data?.totalScans ?? 0})`;

  function openEventPicker() {
    const items = [
      {
        id: null as string | null,
        name: 'All events',
        scan_count: data?.totalScans ?? 0,
      },
      ...events,
    ];
    sheet.open(
      // The parent <BottomSheetModal> already wraps its content in a
      // <BottomSheetScrollView>, so a virtualised list (FlatList) here
      // would trip RN's "VirtualizedLists nested in plain ScrollViews"
      // warning. Render a plain <ScrollView> with mapped rows — the
      // event list is small and the sheet handles the scrolling.
      <EventFilterSheetContent
        items={items}
        initialEventFilter={eventFilter}
        onSelect={setEventFilter}
        onClose={sheet.close}
      />,
      { title: 'Filter by event', snapPoints: ['60%', '80%'] }
    );
  }

  async function onExport() {
    if (!data || data.uniqueProspects === 0) return;
    try {
      setExporting(true);
      const csv = await fetchDashboardCsv(eventFilter);
      const today = new Date().toISOString().slice(0, 10);
      const path = `${FileSystem.cacheDirectory ?? ''}otto-booth-${today}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: 'utf8' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values-text',
          dialogTitle: 'Export dashboard CSV',
        });
      } else {
        Alert.alert('Saved', `CSV saved to ${path}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  if (!authChecked || !session) {
    return (
      <View className="flex-1 items-center justify-center bg-otto-bg">
        <Spinner />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-otto-bg">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.accent}
          />
        }>
        <View className="mb-2 flex-row items-end justify-between">
          <View>
            <Text className={text.labelAccent}>Your team</Text>
            <Text className={text.heading}>Dashboard</Text>
          </View>
          {showExport ? (
            <Pressable
              accessibilityRole="button"
              onPress={onExport}
              disabled={exporting}
              className="min-h-[40px] flex-row items-center justify-center rounded-xl bg-otto-accent px-3 active:opacity-90">
              <Text className="text-sm font-semibold text-white">
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <Spinner />
          </View>
        ) : (
          <>
            {error ? (
              <View className="mb-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <Text className={`${text.body} text-red-700`}>
                  {error instanceof Error ? error.message : 'Failed to load.'}
                </Text>
              </View>
            ) : null}

            {data ? (
              <View className="mt-4 gap-4">
                {showFilter ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Filter by event"
                    onPress={openEventPicker}
                    className="flex-row items-center justify-between rounded-xl border border-otto-border bg-otto-card px-4 py-3">
                    <View className="flex-1 flex-row items-center gap-2">
                      <Text className={text.smallMuted}>Event:</Text>
                      <Text className={`${text.bodyStrong} flex-1`} numberOfLines={1}>
                        {triggerLabel}
                      </Text>
                    </View>
                    <Text className="ml-2 text-otto-muted">▾</Text>
                  </Pressable>
                ) : null}

                <View className="flex-row gap-3">
                  <Stat label="Unique prospects" value={stats.uniqueProspects} />
                  <Stat label="Total scans" value={stats.totalScans} />
                </View>

                {data.rows.length > 0 ? (
                  <DashboardSearch
                    query={query}
                    onChange={setQuery}
                    matchCount={query.trim() ? filteredRows.length : null}
                  />
                ) : null}

                <DashboardTable rows={filteredRows} hasQuery={!!query.trim()} />

                <View className="mt-6 items-center gap-2">
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      Linking.openURL('https://www.ottoupdate.com/?utm_source=eventbuddyapp').catch(
                        () => { }
                      )
                    }>
                    <Text className="text-[15px] font-medium text-otto-accent underline">
                      About Otto →
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 rounded-2xl border border-otto-border bg-otto-card p-4">
      <Text className="text-xs uppercase tracking-[0.2em] text-otto-muted">{label}</Text>
      <Text className="mt-1 text-2xl font-semibold text-otto-text">{value}</Text>
    </View>
  );
}

function EventFilterSheetContent({
  items,
  initialEventFilter,
  onSelect,
  onClose,
}: {
  items: Array<{ id: string | null; name: string; scan_count: number }>;
  initialEventFilter: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(initialEventFilter);

  return (
    <ScrollView
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      // Auto-scroll to the currently-selected event so the user
      // immediately sees which one is active when they open the
      // sheet. The content height is small, so this also keeps the
      // active row centred visually.
      contentContainerStyle={{ paddingBottom: 8 }}>
      {items.map((item, i) => {
        const isActive = active === item.id;
        return (
          <View key={item.id || 'all'}>
            {i > 0 ? <View style={styles.separator} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                // Update filter state immediately, then close the
                // sheet on the next frame so the dashboard's filter
                // row re-renders with the new value BEFORE the
                // sheet's dismiss animation starts playing. Without
                // this microtask, the user sees the sheet fade out
                // first, then the row update — feels laggy. With
                // it, the row updates instantly and the sheet
                // dismisses on top of it.
                setActive(item.id);
                onSelect(item.id);
                requestAnimationFrame(() => {
                  onClose();
                });
              }}
              className={`flex-row items-center justify-between rounded-xl px-3 py-3 ${isActive ? 'bg-otto-accent-soft' : ''
                }`}
              style={({ pressed }) => [
                styles.pickerRow,
                isActive && styles.pickerRowActive,
                pressed && { backgroundColor: colors.cardHover },
              ]}>
              <Text
                style={[
                  styles.pickerLabel,
                  isActive
                    ? { color: colors.accent, fontWeight: '600' }
                    : { color: colors.text },
                ]}
                numberOfLines={1}>
                {item.name}
              </Text>
              <Text
                style={[
                  styles.pickerCount,
                  isActive ? { color: colors.accent } : { color: colors.muted },
                ]}>
                {pluralize(item.scan_count, 'scan', 'scans')}
              </Text>
              {isActive ? (
                <Text style={[styles.pickerCheck, { color: colors.accent }]}>✓</Text>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  pickerRowActive: {
    backgroundColor: colors.accentSoft,
  },
  pickerLabel: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
  },
  pickerCount: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  pickerCheck: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});
