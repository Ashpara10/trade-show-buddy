import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';

import {
  useDeleteRecording,
  useInteractionDetail,
  useRegenerateDeepDive,
  useRegenerateProfileImage,
} from '@/lib/queries';
import { colors, text as textClasses } from '@/lib/theme';
import {
  formatDateTime,
  isRecordingActive,
  transcriptStatusClass,
  transcriptStatusLabel,
} from '@/lib/utils';
import { AddBusinessCard } from './AddBusinessCard';
import { DeepDivePanel } from './DeepDivePanel';
import { EventTag } from './EventTag';
import { ProspectImagePicker } from './ProspectImagePicker';
import { RecorderButton } from './RecorderButton';
import { TalkingPointsView } from './TalkingPointsView';
import { Card } from './ui/Card';

type Props = {
  interactionId: string;
  /** Called when the user taps "Scan another" or the header ×. */
  onClose?: () => void;
};

// Full-size sheet body for a prospect's historical view.
//
// The parent <BottomSheetModal> in BottomSheet.tsx wraps its content in a
// single <BottomSheetScrollView>. This component renders plain children
// inside that scroll view — we deliberately do NOT add our own
// BottomSheetScrollView here, because nested scroll views in gorhom v5
// break the scroll/pan gesture handoff (the sheet's pan handler would
// intercept every drag and the inner content would never scroll).
export function ProspectDetailSheet({ interactionId, onClose }: Props) {
  const { data: detail, isLoading, error, refetch } = useInteractionDetail(interactionId);
  const deleteRec = useDeleteRecording();
  const regenDeep = useRegenerateDeepDive();
  const regenImage = useRegenerateProfileImage();

  const forceRefetchRef = useRef<() => void>(() => { });
  useEffect(() => {
    forceRefetchRef.current = () => void refetch();
  }, [refetch]);

  // If the prospect has no image yet, kick off a one-shot regeneration.
  useEffect(() => {
    if (!detail || detail.prospectImageUrl) return;
    void regenImage.mutateAsync(interactionId).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.prospectImageUrl, interactionId]);

  function onDeleteRecording(recordingId: string) {
    Alert.alert('Delete this voice note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteRec.mutate({ interactionId, recordingId }),
      },
    ]);
  }

  if (isLoading) {
    return (
      <View className="mt-6 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View className="items-center justify-center gap-4 p-6">
        <Text className={`${textClasses.body} text-center text-red-700`}>
          {error instanceof Error ? error.message : 'Could not load this prospect.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="min-h-[48px] flex-row items-center justify-center rounded-xl border border-otto-border bg-otto-card px-6">
          <Text className={textClasses.bodyStrong}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-2.5 pt-5 pb-10">
      <TalkingPointsView
        prospectName={detail.prospectName || 'Prospect'}
        prospectRole={detail.prospectRole}
        prospectCompany={detail.prospectCompany}
        prospectImageUrl={detail.prospectImageUrl}
        fitment={detail.fitment}
        points={detail.talkingPoints}
      />
      {/* Add business card — same flow as the post-scan ReadyView. */}
      <AddBusinessCard
        interactionId={detail.interactionId}
        onSaved={() => refetch()}
      />

      {/* Scan details card */}
      <Card className="gap-3 p-5">
        <Text className={textClasses.label}>Scan details</Text>
        <EventTag
          interactionId={detail.interactionId}
          eventId={detail.eventId}
          eventName={detail.eventName}
        />
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {detail.scannedByName ? (
            <Text className={textClasses.smallMuted}>
              by <Text className="text-otto-text">{detail.scannedByName}</Text>
            </Text>
          ) : null}
          <Text className={textClasses.smallMuted}>· {formatDateTime(detail.createdAt)}</Text>
          {detail.prospectLinkedinUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                import('@/lib/utils').then(({ openLinkedInProfile }) =>
                  openLinkedInProfile(detail.prospectLinkedinUrl)
                );
              }}>
              <Text className={`${textClasses.small} text-otto-muted underline`}>
                linkedin profile ↗
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {/* Voice notes */}
      <Card className="gap-3 p-5">
        <View className="flex-row items-baseline justify-between">
          <Text className={textClasses.labelAccent}>Voice notes</Text>
          <Text className="text-xs italic text-otto-muted">
            {detail.recordings.length}/3 voice notes
          </Text>
        </View>
        {detail.recordings.length === 0 ? (
          <Text className={`${textClasses.bodyMuted} italic`}>
            No voice notes yet. Add one below.
          </Text>
        ) : (
          <View className="gap-2.5">
            {detail.recordings.map((r) => (
              <View
                key={r.id}
                className="gap-1.5 rounded-lg border border-otto-border bg-otto-bg-soft p-3">
                <View className="flex-row items-center justify-between">
                  <Text className={textClasses.smallMuted}>{formatDateTime(r.recorded_at)}</Text>
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`flex-row items-center gap-1.5 rounded-full px-2 py-0.5 ${transcriptStatusClass(r.transcript_status)}`}>
                      {isRecordingActive(r) ? (
                        <ActivityIndicator size="small" color={colors.warning} />
                      ) : null}
                      <Text className="text-xs">
                        {transcriptStatusLabel(r.transcript_status)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete voice note"
                      onPress={() => onDeleteRecording(r.id)}
                      className="rounded-md px-1.5 py-0.5 active:bg-otto-card-hover">
                      <Text className="text-base text-otto-muted">×</Text>
                    </Pressable>
                  </View>
                </View>
                {r.transcript_status === 'done' && r.transcript ? (
                  <Text className={textClasses.body}>{r.transcript}</Text>
                ) : null}
                {r.transcript_status === 'failed' ? (
                  <Text className="text-xs text-otto-danger">
                    Transcription failed. Audio is saved.
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
        <RecorderButton
          interactionId={detail.interactionId}
          recordingsCount={detail.recordings.length}
          label={
            detail.recordings.length === 0 ? 'Record a voice note' : 'Add another voice note'
          }
          doneMessage="Voice note saved. Transcript will appear shortly."
        />
      </Card>

      <ProspectImagePicker interactionId={detail.interactionId} images={detail.images} />

      <DeepDivePanel
        interactionId={detail.interactionId}
        initialDeepDive={detail.deepDive}
        pollUntilReady={!detail.deepDive}
      />


      {detail.deepDive ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void regenDeep.mutateAsync(interactionId).catch(() => { });
          }}
          disabled={regenDeep.isPending}
          className="self-center">
          <Text className="text-[15px] text-otto-muted underline">
            {regenDeep.isPending ? 'Regenerating…' : 'Regenerate deep dive'}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        className="mt-2 min-h-[52px] flex-row items-center justify-center rounded-2xl bg-otto-accent active:opacity-90">
        <Text className="text-base font-semibold text-white">Scan another</Text>
      </Pressable>

      <View className="mt-6 items-center">
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            Linking.openURL('https://www.ottoupdate.com/?utm_source=eventbuddyapp').catch(
              () => { }
            )
          }>
          <Text className="text-[15px] font-medium text-otto-accent underline">About Otto →</Text>
        </Pressable>
      </View>
    </View>
  );
}

