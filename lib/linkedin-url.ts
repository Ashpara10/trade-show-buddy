// LinkedIn URL validation. Mirrors @tsb/lib/utils/linkedin-url.ts.

export type LinkedInValidation =
  | { valid: true; url: string; handle: string }
  | { valid: false; reason: string };

export function normalizeLinkedInUrl(input: string): LinkedInValidation {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'No URL provided.' };
  }
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) {
    raw = 'https://' + raw;
  }
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
  return {
    valid: true,
    url: `https://www.linkedin.com/in/${handle}`,
    handle,
  };
}
