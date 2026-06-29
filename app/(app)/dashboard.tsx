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
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
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
      <BottomSheetFlatList
        data={items}
        keyExtractor={(e) => e.id || 'all'}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEventFilter(item.id);
              sheet.close();
            }}
            style={({ pressed }) => [
              styles.pickerRow,
              eventFilter === item.id && styles.pickerRowActive,
              pressed && { backgroundColor: colors.cardHover },
            ]}>
            <Text
              style={[
                styles.pickerLabel,
                eventFilter === item.id
                  ? { color: colors.accent, fontWeight: '600' }
                  : { color: colors.text },
              ]}
              numberOfLines={1}>
              {item.name}
            </Text>
            <Text
              style={[
                styles.pickerCount,
                eventFilter === item.id ? { color: colors.accent } : { color: colors.muted },
              ]}>
              {pluralize(item.scan_count, 'scan', 'scans')}
            </Text>
          </Pressable>
        )}
      />,
      { title: 'Filter by event', snapPoints: ['50%', '80%'] }
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
                        () => {}
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
});
