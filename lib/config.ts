// App config — read from EXPO_PUBLIC_* at build time, inlined by Metro.

const rawBase = process.env.EXPO_PUBLIC_API_BASE?.trim() || '';

if (!rawBase) {
  // Surface misconfig in dev/CI; the app shows a banner if it's still empty
  // at runtime.
  console.warn(
    '[config] EXPO_PUBLIC_API_BASE is not set. The mobile app cannot reach the booth backend until you add it to .env (see .env.example).'
  );
}

export const API_BASE = rawBase.replace(/\/$/, '');
export const BOOTH_SLUG = process.env.EXPO_PUBLIC_BOOTH_SLUG?.trim() || 'saastr';
export const APP_NAME = 'Trade Show Buddy';
export const APP_TAGLINE = 'Better conversations, instant.';
