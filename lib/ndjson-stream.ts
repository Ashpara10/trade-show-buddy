// NDJSON stream parser. Splits a string into typed events.
//
// The @tsb server streams JSON Lines (one event per line). React Native's
// fetch doesn't expose response.body as a ReadableStream, so we read the
// whole body as text and split on newlines. We lose true streaming but the
// response is buffered at once — fine for the scan pipeline (the talking-
// points event has 30-60s of upstream latency, then a burst of events).

import type { StreamEvent } from './types';

export async function* parseNdjson(text: string): AsyncGenerator<StreamEvent> {
  if (!text) return;
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      yield JSON.parse(trimmed) as StreamEvent;
    } catch {
      // skip malformed line
    }
  }
}
