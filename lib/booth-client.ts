// Booth operation endpoints — scan, dashboard, interaction detail, voice
// notes, photos, deep-dive, profile image, CSV export.

import { getJson, getText, postForm, postJson, postJsonStream } from './api';
import { BOOTH_SLUG } from './config';
import { parseNdjson } from './ndjson-stream';
import type {
  DashboardResponse,
  FitmentResult,
  InteractionDetail,
  ProspectMeta,
  Recording,
  ScanResult,
  StreamEvent,
} from './types';

export async function startScan(
  linkedinUrl: string,
  opts: {
    boothSlug?: string;
    eventId?: string | null;
    onEvent: (ev: StreamEvent) => void;
  }
): Promise<ScanResult> {
  const text = await postJsonStream('/api/scan', {
    linkedinUrl,
    boothSlug: opts.boothSlug || 'otto',
    eventId: opts.eventId || undefined,
  });
  let lastError = '';
  let done: ScanResult | null = null;
  for await (const ev of parseNdjson(text)) {
    opts.onEvent(ev);
    if (ev.type === 'error') lastError = ev.message;
    else if (ev.type === 'done') done = ev.data as ScanResult;
  }
  if (lastError) throw new Error(lastError);
  if (!done) throw new Error('Scan ended without a result.');
  return done;
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  return getJson<DashboardResponse>('/api/dashboard');
}

export async function fetchInteractionDetail(interactionId: string): Promise<InteractionDetail> {
  return getJson<InteractionDetail>(`/api/interaction/${interactionId}`);
}

export async function fetchDashboardCsv(eventId?: string | null): Promise<string> {
  const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
  return getText(`/api/dashboard/export${q}`);
}

// ── Voice notes ─────────────────────────────────────────────────────────────
export async function uploadRecording(opts: {
  interactionId: string;
  uri: string;
  mime: string;
  ext: string;
}): Promise<{ recordingId: string }> {
  const fd = new FormData();
  // RN FormData accepts { uri, name, type } objects.
  fd.append('audio', {
    uri: opts.uri,
    name: `recording.${opts.ext}`,
    type: opts.mime,
  } as unknown as Blob);
  fd.append('interactionId', opts.interactionId);
  fd.append('mime', opts.mime);
  const res = await postForm<{ recordingId: string; error?: string }>('/api/recording/upload', fd);
  if (!res.recordingId) throw new Error('Server did not return a recording id.');
  return res;
}

export async function kickoffTranscribe(opts: {
  interactionId: string;
  recordingId: string;
}): Promise<void> {
  // Fire-and-forget on the server too; we just trigger it.
  try {
    await postJson('/api/recording/transcribe', opts);
  } catch {
    /* non-fatal */
  }
}

export async function deleteRecording(opts: {
  interactionId: string;
  recordingId: string;
}): Promise<void> {
  await postJson('/api/recording/delete', opts);
}

// ── Photos ──────────────────────────────────────────────────────────────────
export async function uploadProspectImage(opts: {
  interactionId: string;
  uri: string;
  mime: string;
}): Promise<unknown> {
  const fd = new FormData();
  fd.append('image', {
    uri: opts.uri,
    name: 'photo.jpg',
    type: opts.mime,
  } as unknown as Blob);
  fd.append('interactionId', opts.interactionId);
  return postForm('/api/prospect-image/upload', fd);
}

export async function deleteProspectImage(opts: {
  interactionId: string;
  url: string;
}): Promise<void> {
  await postJson('/api/prospect-image/delete', opts);
}

// ── Deep dive / profile image regen ────────────────────────────────────────
export async function regenerateDeepDive(interactionId: string): Promise<void> {
  await postJson(`/api/interaction/${interactionId}/regenerate-deep-dive`, {});
}

export async function regenerateProfileImage(interactionId: string): Promise<void> {
  await postJson(`/api/interaction/${interactionId}/regenerate-profile-image`, {});
}

// ── Badge / business-card / contact-card resolution ────────────────────────
// Mirror of @tsb's PhotoCaptureButton flow on the web: capture a photo
// (camera or library), base64-encode, POST to the resolve endpoint, and
// read back the candidate list / extracted contact.

export type ProspectCandidate = {
  name: string;
  title?: string;
  company?: string;
  linkedinUrl: string;
};

export type BadgeResolveOutcome = {
  extracted: { name: string; company: string | null };
  candidates: ProspectCandidate[];
};

export async function resolveBadge(opts: {
  image?: string;
  mediaType?: string;
  name?: string;
  company?: string;
}): Promise<BadgeResolveOutcome> {
  return postJson<BadgeResolveOutcome>('/api/badge-resolve', opts);
}

export type CardContact = {
  name: string | null;
  title: string | null;
  company: string | null;
  emails: string[];
  phones: string[];
  address: string | null;
  website: string | null;
  social: string[];
};

export type CardResolveOutcome = {
  contact: CardContact;
  candidates: ProspectCandidate[];
};

export async function resolveCard(opts: {
  images: { image: string; mediaType?: string }[];
  qrPayloads?: string[];
}): Promise<CardResolveOutcome> {
  return postJson<CardResolveOutcome>('/api/card-resolve', opts);
}

export async function saveContactOnly(opts: {
  contactCard: CardContact;
  eventId?: string | null;
}): Promise<{ interactionId: string }> {
  return postJson<{ interactionId: string }>('/api/contact-only', opts);
}

export async function attachContactCard(opts: {
  interactionId: string;
  contactCard: CardContact;
}): Promise<void> {
  await postJson(`/api/interaction/${opts.interactionId}/contact-card`, {
    contactCard: opts.contactCard,
  });
}

// Re-exports for the stream parser types
export type { Recording, FitmentResult, ProspectMeta };
