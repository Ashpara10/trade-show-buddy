// React Query hooks — every server call goes through these. Centralizes
// caching, refetching, and invalidation so screens stay thin.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteRecording as deleteRecordingApi,
  deleteProspectImage as deleteProspectImageApi,
  fetchDashboard,
  fetchInteractionDetail,
  kickoffTranscribe,
  regenerateDeepDive,
  regenerateProfileImage,
  uploadProspectImage as uploadProspectImageApi,
  uploadRecording as uploadRecordingApi,
} from './booth-client';
import {
  createEvent,
  fetchEvents,
  fetchMe,
  logout as logoutApi,
  setInteractionEvent,
} from './auth-client';
import type { AuthUser } from './auth-client';
import type { DashboardResponse, EventWithCount, InteractionDetail } from './types';

export const qk = {
  me: ['me'] as const,
  events: ['events'] as const,
  dashboard: ['dashboard'] as const,
  interaction: (id: string) => ['interaction', id] as const,
};

// ── Auth ────────────────────────────────────────────────────────────────────
export function useMe() {
  return useQuery<AuthUser | null>({
    queryKey: qk.me,
    queryFn: fetchMe,
    staleTime: 60_000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logoutApi,
    onSettled: () => qc.clear(),
  });
}

// ── Events ──────────────────────────────────────────────────────────────────
export function useEvents() {
  return useQuery<EventWithCount[]>({
    queryKey: qk.events,
    queryFn: fetchEvents,
    staleTime: 30_000,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createEvent(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events }),
  });
}

export function useSetInteractionEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ interactionId, eventId }: { interactionId: string; eventId: string }) =>
      setInteractionEvent(interactionId, eventId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.interaction(vars.interactionId) });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: qk.dashboard,
    queryFn: fetchDashboard,
    staleTime: 10_000,
  });
}

// ── Interaction detail ──────────────────────────────────────────────────────
export function useInteractionDetail(interactionId: string | null | undefined) {
  return useQuery<InteractionDetail>({
    queryKey: interactionId ? qk.interaction(interactionId) : ['interaction', 'none'],
    queryFn: () => fetchInteractionDetail(interactionId as string),
    enabled: !!interactionId,
    staleTime: 5_000,
    refetchInterval: (q) => {
      const detail = q.state.data as InteractionDetail | undefined;
      if (!detail) return false;
      const pending = (detail.recordings || []).some(
        (r) => r.transcript_status !== 'done' && r.transcript_status !== 'failed'
      );
      return pending ? 4_000 : false;
    },
  });
}

// ── Voice notes ─────────────────────────────────────────────────────────────
export function useUploadRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadRecordingApi,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: qk.interaction(vars.interactionId) });
      // Kick off transcription; ignore failures (poll will pick it up).
      void kickoffTranscribe({
        interactionId: vars.interactionId,
        recordingId: data.recordingId,
      }).catch(() => {});
    },
  });
}

export function useDeleteRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRecordingApi,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.interaction(vars.interactionId) });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// ── Photos ──────────────────────────────────────────────────────────────────
export function useUploadImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadProspectImageApi,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.interaction(vars.interactionId) });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useDeleteImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProspectImageApi,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.interaction(vars.interactionId) });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// ── Regeneration ────────────────────────────────────────────────────────────
export function useRegenerateDeepDive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interactionId: string) => regenerateDeepDive(interactionId),
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: qk.interaction(id) }),
  });
}

export function useRegenerateProfileImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interactionId: string) => regenerateProfileImage(interactionId),
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: qk.interaction(id) }),
  });
}
