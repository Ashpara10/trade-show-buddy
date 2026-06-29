// Small helpers shared across screens.

import { Linking } from 'react-native';
import type { ProspectImage, Recording, TranscriptStatus } from './types';

// Tiny className merge helper. NativeWind uses Tailwind so order doesn't
// matter the way it does in classic CSS, but we still want to:
//   1. Concatenate truthy strings (filtering out false/null/undefined)
//   2. De-duplicate conflicting Tailwind classes (e.g. "px-3 px-5" → "px-5")
//   3. Behave like `clsx` + `tailwind-merge`Swithout adding a dep.
//
// The de-dup pass handles the common cases (padding, margin, color,
// background, text, flex, gap, etc.) by parsing each class into its
// "prefix:rest" pair. If two classes share a prefix, the later one wins —
// matching the order the caller wrote them, same as tailwind-merge's
// "later wins" rule. This is intentionally not a full tailwind-merge port:
// it covers what this app actually uses. For anything exotic, just use
// the `cn(...)` call as a list and put the winning class last.
const TAILWIND_PREFIXES = new Set([
  'p',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
  'ms',
  'me',
  'w',
  'h',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
  'rounded',
  'rounded-t',
  'rounded-r',
  'rounded-b',
  'rounded-l',
  'rounded-tl',
  'rounded-tr',
  'rounded-br',
  'rounded-bl',
  'border',
  'border-t',
  'border-r',
  'border-b',
  'border-l',
  'border-x',
  'border-y',
  'bg',
  'text',
  'fill',
  'stroke',
  'flex',
  'grid',
  'opacity',
  'z',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'shadow',
  'ring',
  'outline',
]);

function lastWins(classes: string[]): string[] {
  // Walk right-to-left keeping only the first occurrence of each prefix.
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = classes.length - 1; i >= 0; i--) {
    const c = classes[i];
    if (!c) continue;
    // "px-5" → prefix "px"; arbitrary values like "px-[12px]" → prefix "px".
    const m = c.match(/^-?([a-z0-9-]+?)(?:-[A-Z0-9[\]].*)?$/);
    const prefix = m?.[1];
    const key = prefix && TAILWIND_PREFIXES.has(prefix) ? prefix : c;
    if (seen.has(key)) continue;
    seen.add(key);
    out.unshift(c);
  }
  return out;
}

type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

function flatten(value: ClassValue): string[] {
  if (!value) return [];
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap(flatten);
  }
  // object form: { 'bg-red-500': true, 'opacity-50': false }
  const out: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    if (v) out.push(...flatten(k));
  }
  return out;
}

export function cn(...inputs: ClassValue[]): string {
  return lastWins(flatten(inputs)).join(' ');
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function transcriptStatusLabel(s: string): string {
  if (s === 'done') return 'transcribed';
  if (s === 'failed') return 'failed';
  if (s === 'processing') return 'transcribing…';
  return s;
}

export function transcriptStatusClass(s: string): string {
  if (s === 'done') return 'bg-otto-success/15 text-otto-success';
  if (s === 'failed') return 'bg-otto-danger/15 text-otto-danger';
  return 'bg-otto-warning/15 text-otto-warning';
}

export const MAX_RECORDINGS = 3;
export const MAX_RECORDING_SEC = 120;
export const MAX_IMAGES = 5;

export function isRecordingActive(r: Recording): boolean {
  return r.transcript_status !== 'done' && r.transcript_status !== 'failed';
}

export function asTranscriptStatus(s: string): TranscriptStatus {
  if (s === 'done' || s === 'failed' || s === 'processing' || s === 'pending') return s;
  return 'pending';
}

// LinkedIn deeplink — try the native app first, then fall back to the URL.
export async function openLinkedInProfile(url: string) {
  // Extract handle from https://www.linkedin.com/in/handle
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!match) return false;
  const handle = match[1];
  const appUrl = `linkedin://in/${handle}`;
  try {
    const supported = await Linking.canOpenURL(appUrl);
    if (supported) {
      await Linking.openURL(appUrl);
      return true;
    }
  } catch {
    /* fall through to web URL */
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// ── LinkedIn URL validation (mirror of @tsb/lib/utils/linkedin-url.ts) ──────
export type LinkedInValidation =
  | { valid: true; url: string; handle: string }
  | { valid: false; reason: string };

export function normalizeLinkedInUrl(input: string): LinkedInValidation {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'No URL provided.' };
  }
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { valid: false, reason: 'Invalid URL format.' };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!/(^|\.)linkedin\.com$/.test(host)) {
    return { valid: false, reason: 'Not a LinkedIn URL.' };
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'in' || !segments[1]) {
    return {
      valid: false,
      reason: 'Not a LinkedIn profile URL — please show the QR code from your LinkedIn profile.',
    };
  }
  const handle = decodeURIComponent(segments[1]).toLowerCase();
  if (!/^[a-z0-9-_%.]+$/i.test(handle)) {
    return { valid: false, reason: 'LinkedIn handle looks malformed.' };
  }
  return { valid: true, url: `https://www.linkedin.com/in/${handle}`, handle };
}

// Compact prospect count badge — used in event filter.
export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

// Type guards
export function isProspectImageArray(v: unknown): v is ProspectImage[] {
  return Array.isArray(v) && v.every((x) => x && typeof (x as ProspectImage).url === 'string');
}
