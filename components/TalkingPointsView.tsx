import { ScrollView, Text, View, Pressable, Linking } from 'react-native';

import { Avatar } from './ui/Avatar';
import { Card, Section, SkeletonSection } from './ui/Card';
import { AxisChip, AxisSkeleton } from './ui/Chip';
import { text } from '@/lib/theme';
import type { FitmentResult, TalkingPoints } from '@/lib/types';

type Props = {
  prospectName: string;
  prospectRole: string;
  prospectCompany: string;
  prospectImageUrl?: string | null;
  fitment: FitmentResult | null;
  // null = still streaming; show skeletons.
  points: TalkingPoints | null;
  debug?: boolean;
};

type MergedItem = { text: string; source_url?: string; reasoning?: string };

// Mirror of @tsb/components/talking-points/TalkingPointsView.tsx — full port
// of the person/company card, intel section, talk-about bullets, and
// "curiosity question" blockquote.
export function TalkingPointsView({
  prospectName,
  prospectRole,
  prospectCompany,
  prospectImageUrl,
  fitment,
  points,
  debug = false,
}: Props) {
  return (
    <View className="gap-4">
      <Card className="overflow-hidden">
        {/* PERSON SECTION */}
        <View className="p-5">
          <View className="flex flex-col items-start gap-3">
            <Avatar src={prospectImageUrl} name={prospectName} size={56} />
            <View className="flex-1">
              <Text className="text-[22px] font-semibold leading-tight text-otto-text">
                {prospectName}
              </Text>
              {fitment?.profile_facts?.employment_status === 'previous' && (
                <BetweenRolesPill end={fitment.profile_facts.last_company_end} />
              )}
              {(prospectRole || fitment?.profile_facts?.tenure) && (
                <Text className={`mt-1 ${text.smallMuted}`}>
                  {fitment?.profile_facts?.employment_status === 'previous' ? (
                    <>
                      <Text className="text-otto-muted/80">Last role:</Text>{' '}
                      {[prospectRole, fitment.profile_facts.tenure].filter(Boolean).join(' · ')}
                    </>
                  ) : (
                    [prospectRole, fitment?.profile_facts?.tenure].filter(Boolean).join(' · ')
                  )}
                </Text>
              )}
            </View>
            {fitment?.profile_match ? (
              <AxisChip label="Profile" verdict={fitment.profile_match} />
            ) : (
              <AxisSkeleton label="Profile" />
            )}
          </View>
        </View>

        {/* COMPANY SECTION */}
        <View className="border-t border-otto-border p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[19px] font-semibold leading-tight text-otto-text">
                {fitment?.profile_facts?.employment_status === 'previous' && prospectCompany
                  ? `Previously at ${prospectCompany}`
                  : prospectCompany || '–'}
              </Text>
              {fitment?.company_facts && (
                <View className="mt-2 gap-1">
                  {fitment.company_facts.industry && (
                    <Text className={text.smallMuted}>• {fitment.company_facts.industry}</Text>
                  )}
                  {fitment.company_facts.employees != null && (
                    <Text className={text.smallMuted}>
                      • {fitment.company_facts.employees.toLocaleString()} employees
                    </Text>
                  )}
                  {fitment.company_facts.founded_year != null && (
                    <Text className={text.smallMuted}>
                      • Founded {fitment.company_facts.founded_year}
                    </Text>
                  )}
                </View>
              )}
            </View>
            {fitment?.company_match ? (
              <AxisChip label="Company" verdict={fitment.company_match} />
            ) : (
              <AxisSkeleton label="Company" />
            )}
          </View>
        </View>

        {debug && fitment && (
          <View className="border-t border-otto-border p-5">
            <DebugFitment fitment={fitment} />
          </View>
        )}
      </Card>

      {points ? (
        <View className="gap-4">
          {points.intel && points.intel.text && (
            <IntelSection
              text={points.intel.text}
              label={points.intel.label}
              sourceUrl={points.intel.source_url}
            />
          )}
          <Section label="Talk about" hint="Hold a strong conversation">
            {mergeTalkingItems(points).map((item, i) => (
              <View key={i} className="flex-row items-start gap-3">
                <View className="mt-0.5 h-6 w-6 shrink-0 items-center justify-center rounded-full bg-otto-accent/15">
                  <Text className="text-[13px] font-semibold text-otto-accent">{i + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className={text.body}>{item.text}</Text>
                  {item.source_url && (
                    <Pressable onPress={() => Linking.openURL(item.source_url!)}>
                      <Text className="mt-1 text-xs text-otto-muted underline">source ↗</Text>
                    </Pressable>
                  )}
                  {debug && item.reasoning && (
                    <Text className="mt-1 text-xs text-otto-muted">{item.reasoning}</Text>
                  )}
                </View>
              </View>
            ))}
            {mergeTalkingItems(points).length === 0 && (
              <Text className="text-[15px] italic text-otto-muted">
                (Nothing strong enough to surface.)
              </Text>
            )}
          </Section>
          {points.poke_the_bear && points.poke_the_bear.text && (
            <PokeTheBearSection
              text={points.poke_the_bear.text}
              reasoning={points.poke_the_bear.reasoning}
              debug={debug}
            />
          )}
        </View>
      ) : (
        <View className="gap-4">
          <SkeletonSection label="Intel" hint="Looking up…" />
          <SkeletonSection label="Talk about" hint="Building…" />
          <SkeletonSection label="Curiosity question" hint="Drafting…" />
        </View>
      )}
    </View>
  );
}

function mergeTalkingItems(points: TalkingPoints): MergedItem[] {
  const obs: MergedItem[] = (points.observations || []).map((o) => ({
    text: o.text,
    source_url: o.source_url,
  }));
  const rel: MergedItem[] = (points.relevance || []).map((r) => ({
    text: r.text,
    reasoning: r.reasoning,
  }));
  return [...obs, ...rel].slice(0, 3);
}

function IntelSection({
  text: txt,
  label,
  sourceUrl,
}: {
  text: string;
  label?: string;
  sourceUrl?: string;
}) {
  return (
    <Card className="p-5">
      <View className="mb-3 flex-row items-baseline justify-between gap-3">
        <Text className={text.labelAccent}>Intel</Text>
        {label && (
          <Text className="text-xs text-otto-muted" numberOfLines={1}>
            · {label}
          </Text>
        )}
      </View>
      <Text className={text.bodyStrong}>
        {txt}
        {sourceUrl ? ' ' : null}
        {sourceUrl && <Text className="text-xs text-otto-muted"> source ↗</Text>}
      </Text>
    </Card>
  );
}

function PokeTheBearSection({
  text: txt,
  reasoning,
  debug,
}: {
  text: string;
  reasoning?: string;
  debug?: boolean;
}) {
  return (
    <Card className="p-5">
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className={text.labelAccent}>Curiosity question</Text>
        <Text className={text.smallMuted}>Ask them this</Text>
      </View>
      <Text className={`${text.body} border-l-2 border-otto-accent/50 pl-4 italic`}>“{txt}”</Text>
      {debug && reasoning && <Text className="mt-2 text-xs text-otto-muted">{reasoning}</Text>}
    </Card>
  );
}

function BetweenRolesPill({ end }: { end?: string }) {
  return (
    <View className="mt-2 flex-row items-center gap-1.5 self-start rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">
      <View className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      <Text className="text-xs font-medium text-amber-800">
        Between roles{end ? ` · left ${end}` : ''}
      </Text>
    </View>
  );
}

function DebugFitment({ fitment }: { fitment: FitmentResult }) {
  return (
    <View>
      <Text className={`${text.label} mb-2`}>Debug · strategy: {fitment.strategy}</Text>
      <Text className={`${text.smallMuted} font-mono`} style={{ fontFamily: 'monospace' }}>
        {JSON.stringify(fitment.signals || {}, null, 2)}
      </Text>
    </View>
  );
}
