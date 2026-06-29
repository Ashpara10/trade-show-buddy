import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useSession } from '@/components/SessionContext';
import { Spinner } from '@/components/ui/Button';
import { QrScanner } from '@/components/QrScanner';
import { TalkingPointsView } from '@/components/TalkingPointsView';
import { DeepDivePanel } from '@/components/DeepDivePanel';
import { RecorderButton } from '@/components/RecorderButton';
import { ProspectImagePicker } from '@/components/ProspectImagePicker';
import { EventSelector } from '@/components/ui/EventSelector';
import { createEvent, fetchEvents } from '@/lib/auth-client';
import {
  attachContactCard,
  resolveBadge,
  resolveCard,
  saveContactOnly,
  startScan,
  uploadProspectImage,
  fetchInteractionDetail,
  type CardContact,
  type ProspectCandidate,
} from '@/lib/booth-client';
import { getActiveEvent, setActiveEvent } from '@/lib/active-event';
import type { ActiveEvent, EventWithCount, ProspectImage, ProspectMeta, ScanResult } from '@/lib/types';
import { colors } from '@/lib/theme';
import { cn, normalizeLinkedInUrl } from '@/lib/utils';
import { BOOTH_SLUG } from '@/lib/config';
import { IdIcon, QrCode01Icon, StudentCardIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';

type Phase =
  | 'idle'
  | 'scanning'
  | 'badge-resolving'
  | 'badge-picker'
  | 'card-resolving'
  | 'card-review'
  | 'processing'
  | 'ready'
  | 'error';

export default function ScanScreen() {
  const router = useRouter();
  const { session, authChecked } = useSession();

  useEffect(() => {
    if (authChecked && !session) router.replace('/' as never);
  }, [authChecked, session, router]);

  if (!authChecked || !session) {
    return (
      <View className="flex-1 items-center justify-center bg-otto-bg">
        <Spinner />
      </View>
    );
  }
  return <ScanScreenInner />;
}

function ScanScreenInner() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const [prospect, setProspect] = useState<ProspectMeta | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [activeEvent, setActiveEventState] = useState<ActiveEvent | null>(null);

  // Badge flow state
  const [badgeExtracted, setBadgeExtracted] = useState<{ name: string; company: string | null }>({
    name: '',
    company: null,
  });
  const [badgeCandidates, setBadgeCandidates] = useState<ProspectCandidate[]>([]);

  // Card flow state
  const [cardContact, setCardContact] = useState<CardContact | null>(null);
  const [cardCandidates, setCardCandidates] = useState<ProspectCandidate[]>([]);
  const [cardSaving, setCardSaving] = useState(false);
  const cardFlowRef = useRef(false);

  // Images for the post-scan picker (we fetch them so deletes reflect).
  const [images, setImages] = useState<ProspectImage[]>([]);

  // Load events + resolve the default selection.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const list = await fetchEvents();
        if (cancel) return;
        setEvents(list);
        const stored = await getActiveEvent();
        const chosen =
          (stored && list.find((e) => e.id === stored.id)) ||
          (stored && list.find((e) => e.name.toLowerCase() === stored.name.toLowerCase())) ||
          list.find((e) => e.name.toLowerCase() === 'general networking') ||
          list[0] ||
          null;
        if (chosen) {
          const next = { id: chosen.id, name: chosen.name };
          setActiveEventState(next);
          await setActiveEvent(next);
        }
      } catch {
        /* server falls back to General Networking */
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  function chooseEvent(next: ActiveEvent) {
    setActiveEventState(next);
    void setActiveEvent(next);
  }

  async function handleCreateEvent(name: string): Promise<ActiveEvent | null> {
    try {
      const ev = await createEvent(name);
      setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [...prev, ev]));
      return { id: ev.id, name: ev.name };
    } catch {
      return null;
    }
  }

  async function refetchImages(interactionId: string) {
    try {
      const detail = await fetchInteractionDetail(interactionId);
      setImages(detail.images || []);
    } catch {
      /* non-critical */
    }
  }

  // ── Sign out is owned by the (app) layout's AppHeader; nothing to do here.

  const reset = useCallback(() => {
    setError('');
    setStatusMessage('');
    setProspect(null);
    setResult(null);
    setBadgeCandidates([]);
    setBadgeExtracted({ name: '', company: null });
    setCardContact(null);
    setCardCandidates([]);
    cardFlowRef.current = false;
    setPhase('idle');
  }, []);

  // Shared handler for any LinkedIn URL — kicked off by QR scan, badge
  // picker selection, or card candidate selection.
  const handleScanned = useCallback(
    async (decoded: string) => {
      const validation = normalizeLinkedInUrl(decoded);
      if (!validation.valid) {
        setError(validation.reason);
        setPhase('error');
        return;
      }

      setPhase('processing');
      setStatusMessage('Connecting…');
      setProspect(null);
      setResult(null);
      setError('');

      try {
        const final = await startScan(validation.url, {
          boothSlug: BOOTH_SLUG,
          eventId: activeEvent?.id,
          onEvent: (ev) => {
            if (ev.type === 'status') {
              setStatusMessage(ev.message);
            } else if (ev.type === 'step' && ev.step === 'profile' && ev.data) {
              const d = ev.data as { name?: string; role?: string; company?: string };
              setProspect({
                name: d.name || 'Prospect',
                role: d.role || '',
                company: d.company || '',
              });
              setPhase('ready');
            } else if (ev.type === 'done') {
              setResult(ev.data as ScanResult);
              setPhase('ready');
            }
          },
        });
        setResult(final);
        setPhase('ready');
        if (final?.interactionId) void refetchImages(final.interactionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Scan failed.');
        setPhase('error');
      }
    },
    [activeEvent]
  );

  // ── QR scanner kickoff ──────────────────────────────────────────────────
  function startQrScanner() {
    setPhase('scanning');
  }

  // ── Badge flow ──────────────────────────────────────────────────────────
  async function startBadgeCapture() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera access denied. Enable it in Settings → Apps.');
        setPhase('error');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = asset.base64;
      if (!base64) {
        setError('Could not read the captured photo.');
        setPhase('error');
        return;
      }
      setPhase('badge-resolving');
      setStatusMessage('Reading the badge…');
      const outcome = await resolveBadge({
        image: `data:${asset.mimeType || 'image/jpeg'};base64,${base64}`,
      });
      setBadgeExtracted(outcome.extracted);
      setBadgeCandidates(outcome.candidates);
      setPhase('badge-picker');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Badge lookup failed.');
      setPhase('error');
    }
  }

  async function retryBadgeLookup(name: string, company: string) {
    setStatusMessage('Looking them up…');
    setPhase('badge-resolving');
    try {
      const outcome = await resolveBadge({ name, company });
      setBadgeExtracted(outcome.extracted);
      setBadgeCandidates(outcome.candidates);
      setPhase('badge-picker');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Badge lookup failed.');
      setPhase('error');
    }
  }

  // ── Card flow ───────────────────────────────────────────────────────────
  async function startCardCapture() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera access denied. Enable it in Settings → Apps.');
        setPhase('error');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = asset.base64;
      if (!base64) {
        setError('Could not read the captured photo.');
        setPhase('error');
        return;
      }
      setPhase('card-resolving');
      setStatusMessage('Reading the card…');
      const outcome = await resolveCard({
        images: [{ image: `data:${asset.mimeType || 'image/jpeg'};base64,${base64}` }],
      });
      const c = outcome.contact;
      if (
        !c.name &&
        !c.company &&
        c.emails.length === 0 &&
        c.phones.length === 0
      ) {
        setError("Couldn't read the card. Please retake the photo in good light.");
        setPhase('error');
        return;
      }
      setCardContact(c);
      setCardCandidates(outcome.candidates || []);
      setPhase('card-review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Card lookup failed.');
      setPhase('error');
    }
  }

  // Pick a candidate from the card review — kick off the full scan
  // flow with the resolved LinkedIn URL.
  const proceedCardCandidate = useCallback(
    (linkedinUrl: string) => {
      cardFlowRef.current = true;
      void handleScanned(linkedinUrl);
    },
    [handleScanned]
  );

  async function onSaveContactOnly() {
    if (!cardContact) return;
    setCardSaving(true);
    try {
      const r = await saveContactOnly({ contactCard: cardContact, eventId: activeEvent?.id });
      router.push(`/p/${r.interactionId}` as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setPhase('error');
    } finally {
      setCardSaving(false);
    }
  }

  // If a scan kicked off from the card flow finishes, attach the contact
  // card to the freshly-created interaction.
  useEffect(() => {
    if (!result || !cardFlowRef.current) return;
    cardFlowRef.current = false;
    if (cardContact) {
      void attachContactCard({ interactionId: result.interactionId, contactCard: cardContact }).catch(
        () => { }
      );
    }
  }, [result, cardContact]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (phase === 'scanning') {
    return <QrScanner onScan={handleScanned} onClose={reset} active />;
  }

  return (
    <View className="flex-1 bg-otto-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled">
          {phase === 'idle' && (
            <View className="gap-5">
              <EventSelector
                events={events}
                value={activeEvent?.id ?? null}
                onChange={chooseEvent}
                onCreate={handleCreateEvent}
              />
              <IdleView
                onBadgeCapture={startBadgeCapture}
                onCardCapture={startCardCapture}
                onStartQr={startQrScanner}
              />
            </View>
          )}

          {(phase === 'processing' ||
            phase === 'badge-resolving' ||
            phase === 'card-resolving') && (
              <ProcessingView statusMessage={statusMessage} />
            )}

          {phase === 'badge-picker' && (
            <CandidatePicker
              extracted={badgeExtracted}
              candidates={badgeCandidates}
              onPick={handleScanned}
              onRetry={(name, company) => void retryBadgeLookup(name, company)}
              onFallbackQr={startQrScanner}
            />
          )}

          {phase === 'card-review' && cardContact && (
            <CardReviewStep
              contact={cardContact}
              candidates={cardCandidates}
              saving={cardSaving}
              onPick={proceedCardCandidate}
              onSaveContactOnly={() => void onSaveContactOnly()}
              onScanQr={() => {
                cardFlowRef.current = true;
                startQrScanner();
              }}
            />
          )}

          {phase === 'ready' && prospect && result && (
            <ReadyView
              prospect={prospect}
              result={result}
              statusMessage={statusMessage}
              images={images}
              onScanAnother={reset}
              onImagesChange={() => refetchImages(result.interactionId)}
            />
          )}

          {phase === 'error' && <ErrorView message={error} onRetry={reset} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function EntryButton({
  onPress,
  primary,
  icon,
  title,
  subtitle,
}: {
  onPress: () => void;
  primary?: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-2xl px-5 py-4',
        primary
          ? 'bg-otto-accent shadow-lg shadow-otto-accent/20 active:bg-otto-accent-hover'
          : 'border border-otto-border bg-otto-card active:bg-otto-card-hover'
      )}>
      <View
        className={cn(
          'h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          primary ? 'bg-white/20' : 'bg-otto-accent/15'
        )}>
        <Text className={cn(primary ? 'text-white' : 'text-otto-accent')}>{icon}</Text>
      </View>
      <View className="flex-1">
        <Text
          className={cn(
            'text-[17px] font-semibold',
            primary ? 'text-white' : 'text-otto-text'
          )}>
          {title}
        </Text>
        <Text
          className={cn(
            'text-xs',
            primary ? 'text-white/80' : 'text-otto-muted'
          )}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function IdleView({
  onBadgeCapture,
  onCardCapture,
  onStartQr,
}: {
  onBadgeCapture: () => void;
  onCardCapture: () => void;
  onStartQr: () => void;
}) {
  return (
    <View className="items-center gap-5 py-8">
      <View className="items-center gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-otto-accent">
          Ready
        </Text>
        <Text className="text-3xl font-semibold tracking-tight text-otto-text text-center">
          Capture a prospect
        </Text>
        <Text className="text-[15px] text-otto-muted text-center">
          Scan their badge, their business card, or their LinkedIn QR.
        </Text>
      </View>

      <EntryButton
        onPress={onBadgeCapture}
        primary
        title="Scan event badge"
        subtitle="Photograph their badge"
        icon={<HugeiconsIcon icon={IdIcon} className="size-6" />}

      />

      <EntryButton
        onPress={onCardCapture}
        title="Scan business card"
        subtitle="Also saves their email & phone"
        icon={<HugeiconsIcon icon={StudentCardIcon} className="size-6" />}
      />

      <View className="w-full flex-row items-center gap-3">
        <View className="h-px flex-1 bg-otto-border" />
        <Text className="text-xs text-otto-muted">no badge or card?</Text>
        <View className="h-px flex-1 bg-otto-border" />
      </View>

      <View className="w-full items-center gap-2">
        <EntryButton
          onPress={onStartQr}
          title="Scan LinkedIn QR"
          subtitle="If they pull up their LinkedIn QR"
          icon={<HugeiconsIcon icon={QrCode01Icon} className="size-6" />}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            Linking.openURL('https://www.linkedin.com/').catch(() => { })
          }>
          <Text className="text-[15px] font-medium text-otto-accent underline">
            How to find the QR on LinkedIn →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BadgeIcon() {
  return (
    <View className="h-4 w-4">
      <View className="absolute left-0 right-0 top-0 h-3 rounded-sm border border-current" />
      <View className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full border border-current" />
      <View className="absolute left-0 right-3 top-1.5 h-px bg-current" />
      <View className="absolute left-0 right-3 top-2.5 h-px bg-current" />
    </View>
  );
}

function CardIcon() {
  return (
    <View className="h-4 w-4">
      <View className="absolute inset-0 rounded-sm border border-current" />
      <View className="absolute left-1 top-1 h-1 w-1 rounded-full border border-current" />
      <View className="absolute left-2.5 right-1 top-1.5 h-px bg-current" />
      <View className="absolute left-2.5 right-2 top-2.5 h-px bg-current" />
    </View>
  );
}

function QrIcon() {
  return (
    <View className="h-4 w-4">
      <View className="absolute left-0 top-0 h-2 w-2 border-l-2 border-t-2 border-current" />
      <View className="absolute right-0 top-0 h-2 w-2 border-r-2 border-t-2 border-current" />
      <View className="absolute bottom-0 left-0 h-2 w-2 border-b-2 border-l-2 border-current" />
      <View className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-current" />
      <View className="absolute left-0 right-0 top-1/2 h-px bg-current" />
    </View>
  );
}

function CandidatePicker({
  extracted,
  candidates,
  onPick,
  onRetry,
  onFallbackQr,
}: {
  extracted: { name: string; company: string | null };
  candidates: ProspectCandidate[];
  onPick: (linkedinUrl: string) => void;
  onRetry: (name: string, company: string) => void;
  onFallbackQr: () => void;
}) {
  const [name, setName] = useState(extracted.name || '');
  const [company, setCompany] = useState(extracted.company || '');
  const [editing, setEditing] = useState(candidates.length === 0);

  const hasCandidates = candidates.length > 0;

  return (
    <View className="gap-4 py-2">
      <View className="rounded-2xl border border-otto-border bg-otto-card p-5">
        <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-otto-accent">
          {hasCandidates ? 'We found a match' : 'No match found'}
        </Text>
        <Text className="mt-2 text-[17px] font-semibold text-otto-text">
          {extracted.name || 'Unknown name'}
        </Text>
        {extracted.company ? (
          <Text className="text-[15px] text-otto-muted">{extracted.company}</Text>
        ) : null}
      </View>

      {hasCandidates ? (
        <View className="gap-3 rounded-2xl border border-otto-border bg-otto-card p-4">
          <Text className="text-[15px] text-otto-muted">
            {candidates.length === 1
              ? 'Is this them? Tap to confirm and pull research.'
              : 'Pick the right person to pull research.'}
          </Text>
          {candidates.map((c) => (
            <Pressable
              key={c.linkedinUrl}
              accessibilityRole="button"
              onPress={() => onPick(c.linkedinUrl)}
              className="flex-row items-center gap-3 rounded-xl border border-otto-border bg-otto-bg p-3 active:bg-otto-card-hover">
              <View className="flex-1">
                <Text
                  className="text-[15px] font-semibold text-otto-text"
                  numberOfLines={1}>
                  {c.name}
                </Text>
                {c.title ? (
                  <Text className="text-xs text-otto-text-soft" numberOfLines={1}>
                    {c.title}
                  </Text>
                ) : null}
                {c.company ? (
                  <Text className="text-xs text-otto-muted" numberOfLines={1}>
                    {c.company}
                  </Text>
                ) : null}
              </View>
              <Text className="text-otto-muted">›</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditing(true)}
            className="rounded-xl border border-otto-border bg-otto-bg px-4 py-2.5 active:bg-otto-card-hover">
            <Text className="text-center text-[15px] font-medium text-otto-text">
              None of these — edit name/company
            </Text>
          </Pressable>
        </View>
      ) : null}

      {editing ? (
        <View className="gap-3 rounded-2xl border border-otto-border bg-otto-card p-5">
          <Text className="text-[15px] text-otto-muted">Edit the details and retry:</Text>
          <View className="gap-2">
            <Text className="text-[15px] font-medium text-otto-text">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="Jane Doe"
              placeholderTextColor={colors.muted}
              className="rounded-xl border border-otto-border bg-otto-bg px-4 py-3 text-otto-text"
              style={{ fontSize: 17 }}
            />
          </View>
          <View className="gap-2">
            <Text className="text-[15px] font-medium text-otto-text">Company</Text>
            <TextInput
              value={company}
              onChangeText={setCompany}
              autoCapitalize="words"
              placeholder="Acme Inc"
              placeholderTextColor={colors.muted}
              className="rounded-xl border border-otto-border bg-otto-bg px-4 py-3 text-otto-text"
              style={{ fontSize: 17 }}
            />
          </View>
          <PrimaryGreenButton
            label="Look them up"
            onPress={() => onRetry(name.trim(), company.trim())}
            disabled={!name.trim() && !company.trim()}
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onFallbackQr}
        className="rounded-xl border border-otto-border bg-otto-card px-4 py-3 active:bg-otto-card-hover">
        <Text className="text-center text-[15px] font-medium text-otto-text">
          Scan their LinkedIn QR instead
        </Text>
      </Pressable>
    </View>
  );
}

function CardReviewStep({
  contact,
  candidates,
  saving,
  onPick,
  onSaveContactOnly,
  onScanQr,
}: {
  contact: CardContact;
  candidates: ProspectCandidate[];
  saving: boolean;
  onPick: (linkedinUrl: string) => void;
  onSaveContactOnly: () => void;
  onScanQr: () => void;
}) {
  const [name, setName] = useState(contact.name || '');
  const [title, setTitle] = useState(contact.title || '');
  const [company, setCompany] = useState(contact.company || '');
  const [emails, setEmails] = useState((contact.emails || []).join(', '));
  const [phones, setPhones] = useState((contact.phones || []).join(', '));

  const hasCandidates = candidates.length > 0;

  return (
    <View className="gap-4 py-2">
      <View className="gap-3 rounded-2xl border border-otto-border bg-otto-card p-5">
        <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-otto-accent">
          Contact card
        </Text>
        <Text className="text-[15px] text-otto-muted">Confirm the extracted details.</Text>

        <View className="gap-2">
          <Text className="text-[15px] font-medium text-otto-text">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-otto-border bg-otto-bg px-4 py-3 text-otto-text"
            style={{ fontSize: 17 }}
          />
        </View>
        <View className="gap-2">
          <Text className="text-[15px] font-medium text-otto-text">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-otto-border bg-otto-bg px-4 py-3 text-otto-text"
            style={{ fontSize: 17 }}
          />
        </View>
        <View className="gap-2">
          <Text className="text-[15px] font-medium text-otto-text">Company</Text>
          <TextInput
            value={company}
            onChangeText={setCompany}
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-otto-border bg-otto-bg px-4 py-3 text-otto-text"
            style={{ fontSize: 17 }}
          />
        </View>
        <View className="gap-2">
          <Text className="text-[15px] font-medium text-otto-text">Emails (comma-separated)</Text>
          <TextInput
            value={emails}
            onChangeText={setEmails}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-otto-border bg-otto-bg px-4 py-3 text-otto-text"
            style={{ fontSize: 17 }}
          />
        </View>
        <View className="gap-2">
          <Text className="text-[15px] font-medium text-otto-text">Phones (comma-separated)</Text>
          <TextInput
            value={phones}
            onChangeText={setPhones}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="phone-pad"
            placeholderTextColor={colors.muted}
            className="rounded-xl border border-otto-border bg-otto-bg px-4 py-3 text-otto-text"
            style={{ fontSize: 17 }}
          />
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-otto-border bg-otto-card p-4">
        <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-otto-accent">
          LinkedIn
        </Text>
        {hasCandidates ? (
          <>
            <Text className="text-[15px] text-otto-muted">
              {candidates.length === 1
                ? 'Is this them? Tap to confirm and pull research.'
                : 'Pick the right person to pull research.'}
            </Text>
            {candidates.map((c) => (
              <Pressable
                key={c.linkedinUrl}
                accessibilityRole="button"
                disabled={saving}
                onPress={() => onPick(c.linkedinUrl)}
                className="flex-row items-center gap-3 rounded-xl border border-otto-border bg-otto-bg p-3 active:bg-otto-card-hover disabled:opacity-50">
                <View className="flex-1">
                  <Text
                    className="text-[15px] font-semibold text-otto-text"
                    numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.title ? (
                    <Text className="text-xs text-otto-text-soft" numberOfLines={1}>
                      {c.title}
                    </Text>
                  ) : null}
                  {c.company ? (
                    <Text className="text-xs text-otto-muted" numberOfLines={1}>
                      {c.company}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-otto-muted">›</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <Text className="text-[15px] text-otto-muted">
            No LinkedIn profile found for this person.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={onScanQr}
          className="rounded-xl border border-otto-border bg-otto-bg px-4 py-2.5 active:bg-otto-card-hover disabled:opacity-50">
          <Text className="text-center text-[15px] font-medium text-otto-text">
            Scan their LinkedIn QR instead
          </Text>
        </Pressable>
      </View>

      <PrimaryGreenButton
        label={
          saving
            ? 'Saving…'
            : hasCandidates
              ? 'Save contact only (skip research)'
              : 'Save contact'
        }
        onPress={onSaveContactOnly}
        disabled={saving}
      />
    </View>
  );
}

function ProcessingView({ statusMessage }: { statusMessage: string }) {
  return (
    <View className="items-center gap-6 py-12">
      <View className="relative h-14 w-14">
        <View className="absolute inset-0 rounded-full border-4 border-otto-accent/20" />
        <ActivityIndicator
          size="large"
          color={colors.accent}
          style={{ position: 'absolute', inset: 0 }}
        />
      </View>
      <Text className="text-[17px] font-semibold text-otto-text">
        {statusMessage || 'Working…'}
      </Text>
      <Text className="px-6 text-center text-[15px] text-otto-muted">
        Fitment first, then talking points. Don&apos;t close this page.
      </Text>
    </View>
  );
}

function ReadyView({
  prospect,
  result,
  statusMessage,
  images,
  onScanAnother,
  onImagesChange,
}: {
  prospect: ProspectMeta;
  result: ScanResult;
  statusMessage: string;
  images: ProspectImage[];
  onScanAnother: () => void;
  onImagesChange: () => void;
}) {
  return (
    <View className="gap-5">
      <TalkingPointsView
        prospectName={result.prospectName || prospect.name || 'Prospect'}
        prospectRole={result.prospectRole || prospect.role}
        prospectCompany={result.prospectCompany || prospect.company}
        prospectImageUrl={result.prospectImageUrl}
        fitment={result.fitment}
        points={result.talkingPoints}
      />

      {!result.talkingPoints && (
        <Text className="text-center text-xs italic text-otto-muted">
          {statusMessage || 'Building observations & relevance…'}
        </Text>
      )}

      <View className="gap-2">
        <Text className="text-xs italic text-otto-muted">0/3 voice notes</Text>
        <RecorderButton interactionId={result.interactionId} recordingsCount={0} />
      </View>

      <AddBusinessCard
        interactionId={result.interactionId}
        onSaved={onImagesChange}
      />

      <View className="rounded-2xl border border-otto-border bg-otto-card p-5">
        <ProspectImagePicker
          interactionId={result.interactionId}
          images={images}
        />
      </View>

      <DeepDivePanel interactionId={result.interactionId} pollUntilReady />

      <Pressable
        accessibilityRole="button"
        onPress={onScanAnother}
        className="rounded-xl border border-otto-border bg-otto-card px-5 py-3 active:bg-otto-card-hover">
        <Text className="text-center text-[15px] font-medium text-otto-text">
          Scan another
        </Text>
      </Pressable>
    </View>
  );
}

function AddBusinessCard({
  interactionId,
  onSaved,
}: {
  interactionId: string;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function capture() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access denied. Enable it in Settings → Apps.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = asset.base64;
      if (!base64) {
        Alert.alert('Could not read the captured photo.');
        return;
      }
      setBusy(true);
      const outcome = await resolveCard({
        images: [{ image: `data:${asset.mimeType || 'image/jpeg'};base64,${base64}` }],
      });
      if (
        !outcome.contact.name &&
        !outcome.contact.company &&
        outcome.contact.emails.length === 0 &&
        outcome.contact.phones.length === 0
      ) {
        Alert.alert("Couldn't read the card. Try again in good light.");
        return;
      }
      await attachContactCard({ interactionId, contactCard: outcome.contact });
      if (asset.uri) {
        try {
          await uploadProspectImage({
            interactionId,
            uri: asset.uri,
            mime: asset.mimeType || 'image/jpeg',
          });
        } catch {
          /* non-critical */
        }
      }
      onSaved?.();
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : 'Could not read the card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={() => void capture()}
      className="flex-row items-center justify-center gap-2 rounded-xl bg-otto-accent px-5 py-3 shadow-lg shadow-otto-accent/20 active:bg-otto-accent-hover disabled:opacity-50">
      <CardIcon />
      <Text className="text-[17px] font-semibold text-white">
        {busy ? 'Saving…' : 'Add business card'}
      </Text>
    </Pressable>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="items-center gap-5 py-12">
      <View className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <Text
          className="text-xs text-red-700"
          style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) }}>
          {message}
        </Text>
      </View>
      <PrimaryGreenButton label="Try again" onPress={onRetry} />
    </View>
  );
}

function PrimaryGreenButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'min-h-[52px] flex-row items-center justify-center rounded-xl px-5 py-3.5',
        disabled ? 'bg-otto-accent/50' : 'bg-otto-accent active:bg-otto-accent-hover'
      )}>
      <Text
        className={cn(
          'text-[17px] font-semibold',
          disabled ? 'text-otto-bg/70' : 'text-otto-bg'
        )}>
        {label}
      </Text>
    </Pressable>
  );
}
