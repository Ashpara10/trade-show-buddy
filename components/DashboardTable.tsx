import { Pressable, Text, View } from 'react-native';

import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';
import { FitmentChip } from './ui/Chip';
import { useBottomSheet } from './BottomSheet';
import { ProspectDetailSheet } from './ProspectDetailSheet';
import { text } from '@/lib/theme';
import { formatDateTime, transcriptStatusClass, transcriptStatusLabel } from '@/lib/utils';
import type { DashboardRow as Row } from '@/lib/types';

type Props = {
  rows: Row[];
  hasQuery?: boolean;
};

// Mirror of @tsb DashboardTable.tsx — article card per row, identity at
// top, meta strip below, action row at the bottom. Tapping a row (or the
// "View talking points" footer link) opens the prospect detail in a
// full-size bottom sheet via the shared <BottomSheetProvider>.
export function DashboardTable({ rows, hasQuery = false }: Props) {
  const sheet = useBottomSheet();

  function openProspect(interactionId: string) {
    sheet.open(<ProspectDetailSheet interactionId={interactionId} onClose={sheet.close} />, {
      title: '',
      snapPoints: ['90%'],
      initialIndex: 0,
    });
  }

  if (rows.length === 0) {
    return (
      <Card className="items-center p-8">
        <Text className={text.bodyMuted}>
          {hasQuery ? 'No match.' : 'No scans yet. Head back to the scanner and meet someone.'}
        </Text>
      </Card>
    );
  }
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <Card key={row.interaction_id} className="overflow-hidden">
          <Pressable
            accessibilityRole="button"
            onPress={() => openProspect(row.interaction_id)}
            className="p-5 active:bg-otto-card-hover">
            <View className="flex-row flex-wrap items-start justify-between gap-3">
              <View className="flex-1 flex-row items-start gap-3">
                <Avatar src={row.profile_image_url} name={row.prospect_name} size={44} />
                <View className="flex-1">
                  <Text className={`${text.bodyStrong} text-otto-text`} numberOfLines={1}>
                    {row.prospect_name || 'Unknown'}
                  </Text>
                  {row.prospect_role && (
                    <Text className={`${text.smallMuted}`} numberOfLines={1}>
                      {row.prospect_role}
                    </Text>
                  )}
                  {row.prospect_company && (
                    <Text
                      className={`${text.small} font-medium text-otto-text-soft`}
                      numberOfLines={1}>
                      {row.prospect_company}
                    </Text>
                  )}
                </View>
              </View>
              {row.fitment && <FitmentChip fitment={row.fitment} />}
            </View>

            <View className="mt-3 flex-row flex-wrap items-center gap-2">
              {row.event_name && (
                <>
                  <Text className="text-xs font-medium text-otto-accent">{row.event_name}</Text>
                  <Text className="text-xs text-otto-muted">·</Text>
                </>
              )}
              {row.scanned_by_name && (
                <Text className="text-xs text-otto-muted">by {row.scanned_by_name}</Text>
              )}
              <Text className="text-xs text-otto-muted">·</Text>
              <Text className="text-xs text-otto-muted">{formatDateTime(row.created_at)}</Text>
              {row.has_recording && (
                <View
                  className={`rounded-full px-2 py-0.5 ${transcriptStatusClass(row.transcript_status)}`}>
                  <Text className="text-xs">
                    transcript: {transcriptStatusLabel(row.transcript_status)}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>

          <View className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-otto-border px-5 py-3">
            {row.linkedin_url ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  import('@/lib/utils').then(({ openLinkedInProfile }) =>
                    openLinkedInProfile(row.linkedin_url)
                  );
                }}>
                <Text className="text-[15px] font-medium text-otto-accent">
                  View LinkedIn Profile →
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable accessibilityRole="link" onPress={() => openProspect(row.interaction_id)}>
              <Text className="text-[15px] font-medium text-otto-accent">
                View talking points →
              </Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </View>
  );
}
