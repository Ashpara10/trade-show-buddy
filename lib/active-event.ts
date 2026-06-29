// Per-device memory of the currently-selected event on the scan page.
// Mirrors @tsb/lib/utils/active-event.ts. Server re-validates eventId
// against the user's company on every scan, so this is just UI state.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveEvent } from './types';

const KEY = 'tsb.mobile.active-event.v1';

export async function getActiveEvent(): Promise<ActiveEvent | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveEvent) : null;
  } catch {
    return null;
  }
}

export async function setActiveEvent(event: ActiveEvent): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(event));
}

export async function clearActiveEvent(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
