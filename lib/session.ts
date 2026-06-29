// Local session mirror. The server's HTTP-only `otto_session` cookie is the
// source of truth. We keep a UI copy in AsyncStorage so we can show
// "Welcome back, {name}" without a network round-trip, and so the app can
// re-prime the API client's cookie cache after a cold start.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { setSessionCookie, getSessionCookie } from './api';
import type { Session } from './types';

const SESSION_KEY = 'tsb.mobile.session.v1';
const COOKIE_KEY = 'tsb.mobile.session.cookie.v1';

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    const cookie = await AsyncStorage.getItem(COOKIE_KEY);
    if (cookie) setSessionCookie(cookie);
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const cookie = getSessionCookie();
  if (cookie) await AsyncStorage.setItem(COOKIE_KEY, cookie);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, COOKIE_KEY]);
  setSessionCookie(null);
}
