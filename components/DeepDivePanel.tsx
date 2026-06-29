import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Card } from './ui/Card';
import { text } from '@/lib/theme';
import { fetchInteractionDetail } from '@/lib/booth-client';
import type { DeepDive } from '@/lib/types';

type Props = {
  interactionId: string;
  initialDeepDive?: DeepDive | null;
  pollUntilReady?: boolean;
};

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 90_000;

// Mirror of @tsb/components/talking-points/DeepDivePanel.tsx — collapsible
// section with a 2-line masked preview, then four labeled blocks when
// expanded. Polls /api/interaction/[id] until deep_dive lands.
export function DeepDivePanel({
  interactionId,
  initialDeepDive = null,
  pollUntilReady = false,
}: Props) {
  const [deepDive, setDeepDive] = useState<DeepDive | null>(initialDeepDive);
  const [loading, setLoading] = useState(pollUntilReady && !initialDeepDive);
  const [timedOut, setTimedOut] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    setDeepDive(initialDeepDive);
  }, [initialDeepDive]);

  useEffect(() => {
    if (!pollUntilReady) return;
    if (deepDive) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      try {
        const detail = await fetchInteractionDetail(interactionId);
        if (cancelled) return;
        if (detail.deepDive) {
          setDeepDive(detail.deepDive);
          setLoading(false);
          return;
        }
      } catch {
        /* keep polling */
      }
      if (Date.now() - startedAt.current >= POLL_TIMEOUT_MS) {
        if (!cancelled) {
          setTimedOut(true);
          setLoading(false);
        }
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [interactionId, pollUntilReady, deepDive]);

  const previewText = deepDive?.prospect_profile?.trim() || '';

  return (
    <Card className="overflow-hidden">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Deep Dive"
        onPress={() => setExpanded((v) => !v)}
        disabled={!deepDive}
        className="flex-row items-center justify-between gap-3 px-5 py-4 active:bg-otto-card-hover">
        <View className="flex-1">
          <Text className={text.labelAccent}>Deep Dive</Text>
          <Text className={`${text.smallMuted} mt-1`}>
            {loading
              ? 'Drafting your follow-up brief…'
              : timedOut
                ? 'Brief is taking longer than expected – check back from the dashboard.'
                : deepDive
                  ? 'Profile, fit rationale, and a follow-up angle for later.'
                  : 'No brief available for this scan.'}
          </Text>
        </View>
        {deepDive && <Text className={`text-otto-muted ${expanded ? 'rotate-180' : ''}`}>▾</Text>}
        {loading && <ActivityIndicator />}
      </Pressable>

      {deepDive && !expanded && previewText ? (
        <View className="px-5 pb-4">
          <Text className={text.body} numberOfLines={2}>
            {previewText}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded(true)}
            className="mt-2 self-start">
            <Text className="text-[15px] font-medium text-otto-accent underline">
              Show full brief
            </Text>
          </Pressable>
        </View>
      ) : null}

      {deepDive && expanded && (
        <View className="gap-4 px-5 pb-5 pt-1">
          <Block label="Prospect profile" body={deepDive.prospect_profile} />
          <Block label="Company deep dive" body={deepDive.company_deep_dive} />
          <Block label="Why this fits" body={deepDive.fit_rationale} />
          <Block label="Follow-up angle" body={deepDive.follow_up_angle} />
        </View>
      )}
    </Card>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  if (!body || !body.trim()) return null;
  const bullets = extractBullets(body);
  return (
    <View className="gap-1.5">
      <Text className="text-[12px] font-semibold uppercase tracking-[0.18em] text-otto-muted">
        {label}
      </Text>
      {bullets ? (
        <View className="gap-2">
          {bullets.map((line, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-base font-bold text-otto-accent">•</Text>
              <Text className={`${text.body} flex-1`}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className={`${text.body}`}>{body}</Text>
      )}
    </View>
  );
}

function extractBullets(body: string): string[] | null {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const bulletPattern = /^(?:[-*•]\s+|\d+\.\s+)/;
  if (!lines.every((l) => bulletPattern.test(l))) return null;
  return lines.map((l) => l.replace(bulletPattern, '').trim()).filter(Boolean);
}
