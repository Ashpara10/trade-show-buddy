// Auth API wrappers — mirror @tsb's RegistrationForm / RegistrationGate flow.

import { getJson, postJson, postJsonStream } from './api';
import { saveSession } from './session';
import { parseNdjson } from './ndjson-stream';
import type { ActiveEvent, Session } from './types';

export type AuthUser = {
  userId: string;
  email: string;
  name: string;
  companyId: string | null;
  domain: string | null;
};

export type SendCodeResult = { email: string; expiresAt: string };

// POST /api/auth/send-code → NDJSON stream. Streams status + done.
export async function sendCode(
  opts: { name: string; email: string },
  onStatus?: (msg: string) => void
): Promise<SendCodeResult> {
  const text = await postJsonStream('/api/auth/send-code', opts);
  let lastError = '';
  let done: SendCodeResult | null = null;
  for await (const ev of parseNdjson(text)) {
    if (ev.type === 'status') onStatus?.(ev.message);
    else if (ev.type === 'error') lastError = ev.message;
    else if (ev.type === 'done') done = ev.data as SendCodeResult;
  }
  if (lastError) throw new Error(lastError);
  if (!done) throw new Error('No completion signal from server.');
  return done;
}

// POST /api/auth/verify-code → JSON + Set-Cookie. Returns the session payload.
export async function verifyCode(opts: { email: string; code: string }): Promise<Session> {
  const body = await postJson<{ ok: boolean; user?: AuthUser; error?: string }>(
    '/api/auth/verify-code',
    opts
  );
  if (!body.ok || !body.user) {
    throw new Error(body.error || 'Verification failed');
  }
  const session: Session = {
    userId: body.user.userId,
    email: body.user.email,
    name: body.user.name,
    companyId: body.user.companyId,
    domain: body.user.domain ?? undefined,
  };
  await saveSession(session);
  return session;
}

// GET /api/auth/me — returns hydrated user, or null on 401.
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const data = await getJson<{ user: AuthUser }>('/api/auth/me');
    return data.user;
  } catch (e) {
    if (String(e).includes('(401)')) return null;
    throw e;
  }
}

export async function logout(): Promise<void> {
  try {
    await postJson('/api/auth/logout', {});
  } catch {
    /* network failure is fine — we still clear locally */
  }
}

// ── Event endpoints ─────────────────────────────────────────────────────────
export async function fetchEvents(): Promise<import('./types').EventWithCount[]> {
  const data = await getJson<{ events: import('./types').EventWithCount[] }>('/api/events');
  return data.events || [];
}

export async function createEvent(name: string): Promise<import('./types').EventWithCount> {
  const data = await postJson<{ event: import('./types').EventWithCount }>('/api/events', { name });
  return data.event;
}

export async function setInteractionEvent(interactionId: string, eventId: string): Promise<void> {
  await postJson(`/api/interaction/${interactionId}/event`, { eventId });
}

// Helper to coerce stored event value into ActiveEvent.
export function asActiveEvent(
  v: { id: string; name: string } | null | undefined
): ActiveEvent | null {
  return v ? { id: v.id, name: v.name } : null;
}
