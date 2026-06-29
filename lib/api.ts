// Minimal typed fetch wrapper for the @tsb API.
//
// The web app uses an HTTP-only `otto_session` cookie as the auth source of
// truth. React Native's fetch does NOT persist cookies across requests, so we
// capture the `Set-Cookie` header from /api/auth/verify-code (and any other
// route that sets it) and resend it explicitly via a Cookie header.
//
// This module is the single chokepoint for all HTTP — every other lib file
// goes through these helpers.

import { API_BASE } from './config';

// In-memory + AsyncStorage-backed cookie cache. Read on every request,
// refreshed from any Set-Cookie response.
let sessionCookie: string | null = null;

export function setSessionCookie(cookie: string | null) {
  sessionCookie = cookie;
}

export function getSessionCookie(): string | null {
  return sessionCookie;
}

function captureSetCookie(res: Response) {
  // The RN fetch polyfill collapses multiple Set-Cookie values into a single
  // comma-separated string, which breaks cookie values that contain a comma
  // (e.g. Date=Wed, 01 Jan 2025 ...). The cookie we care about
  // (otto_session=...) has no commas in its value, so a single regex match
  // is enough.
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return;
  const match = setCookie.match(/(?:^|,)\s?otto_session=[^;]+/);
  if (match) {
    sessionCookie = match[0].replace(/^,\s?/, '').trim();
  } else if (/otto_session=;/.test(setCookie) || /Max-Age=0/.test(setCookie)) {
    sessionCookie = null;
  }
}

type Json = Record<string, string> | undefined;

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown; headers?: Json } = {}
): Promise<T> {
  if (!API_BASE) {
    throw new Error('API base URL is not configured. Set EXPO_PUBLIC_API_BASE in your .env file.');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (init.headers) Object.assign(headers, init.headers);
  if (init.body !== undefined || init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (sessionCookie) headers.Cookie = sessionCookie;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : (init.body as BodyInit | undefined),
  });

  captureSetCookie(res);
  return res as unknown as T;
}

export async function getJson<T>(path: string, headers?: Json): Promise<T> {
  const res = (await request(path, { headers })) as Response;
  if (!res.ok) throw await httpError(res);
  return (await res.json()) as T;
}

export async function postJson<T>(path: string, body: unknown, headers?: Json): Promise<T> {
  const res = (await request(path, { method: 'POST', json: body, headers })) as Response;
  if (!res.ok) throw await httpError(res);
  return (await res.json()) as T;
}

export async function postForm<T>(path: string, form: FormData, headers?: Json): Promise<T> {
  if (!API_BASE) {
    throw new Error('API base URL is not configured.');
  }
  const merged: Record<string, string> = { Accept: 'application/json', ...(headers || {}) };
  if (sessionCookie) merged.Cookie = sessionCookie;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: form,
    headers: merged,
  });
  captureSetCookie(res);
  if (!res.ok) throw await httpError(res);
  return (await res.json()) as T;
}

// Streaming variant — returns the raw Response so callers can read NDJSON
// events (used by /api/auth/send-code and /api/scan). Always reads the body
// to a string because React Native's fetch returns null for response.body on
// most platforms — see lib/ndjson-stream.ts for the parser.
export async function postJsonStream(path: string, body: unknown): Promise<string> {
  if (!API_BASE) {
    throw new Error('API base URL is not configured.');
  }
  const headers: Record<string, string> = {
    Accept: 'application/x-ndjson, application/json',
    'Content-Type': 'application/json',
  };
  if (sessionCookie) headers.Cookie = sessionCookie;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  captureSetCookie(res);
  const text = await res.text();
  if (!res.ok) {
    throw parseErrorText(text, res.status);
  }
  return text;
}

export async function getText(path: string, headers?: Json): Promise<string> {
  if (!API_BASE) {
    throw new Error('API base URL is not configured.');
  }
  const merged: Record<string, string> = { Accept: '*/*', ...(headers || {}) };
  if (sessionCookie) merged.Cookie = sessionCookie;

  const res = await fetch(`${API_BASE}${path}`, { headers: merged });
  captureSetCookie(res);
  if (!res.ok) throw await httpError(res);
  return res.text();
}

async function httpError(res: Response): Promise<Error> {
  const text = await res.text().catch(() => '');
  return parseErrorText(text, res.status);
}

function parseErrorText(text: string, status: number): Error {
  if (!text) return new Error(`Request failed (${status})`);
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    const msg = parsed?.error || parsed?.message;
    if (msg) return new Error(msg);
  } catch {
    /* not JSON */
  }
  return new Error(text);
}
