// Shared types — mirrors @tsb/lib/db/types.ts, narrowed to what the mobile UI
// actually renders. Keep these in sync with the server.

export type Fitment = 'ICP Match' | 'Not ICP Match' | 'Partial Match';
export type AxisVerdict = 'Match' | 'Partial' | 'No Match';

export type ProfileFacts = {
  tenure?: string;
  employment_status?: 'current' | 'previous';
  last_company_end?: string;
};

export type CompanyFacts = {
  industry?: string;
  employees?: number | null;
  employees_range?: string;
  founded_year?: number | null;
};

export type FitmentResult = {
  fitment: Fitment;
  reason: string;
  profile_match?: AxisVerdict;
  profile_facts?: ProfileFacts;
  company_match?: AxisVerdict;
  company_facts?: CompanyFacts;
  strategy: string;
  signals?: Record<string, unknown>;
};

export type TalkingPoints = {
  observations: { text: string; source_url?: string }[];
  relevance: { text: string; reasoning?: string }[];
  poke_the_bear?: { text: string; reasoning?: string } | null;
  intel?: { text: string; source_url?: string; label?: string } | null;
  reasoning?: string;
};

export type DeepDive = {
  prospect_profile: string;
  company_deep_dive: string;
  fit_rationale: string;
  follow_up_angle: string;
};

export type TranscriptStatus = 'pending' | 'processing' | 'done' | 'failed';

export type Recording = {
  id: string;
  url: string;
  recorded_at: string;
  transcript: string | null;
  transcript_status: TranscriptStatus;
};

export type ProspectImage = {
  url: string;
  uploaded_at: string;
};

// ── Scan result returned by /api/scan's "done" event ────────────────────────
export type ScanResult = {
  interactionId: string;
  prospectId: string;
  prospectName: string;
  prospectRole: string;
  prospectCompany: string;
  prospectImageUrl: string | null;
  eventId: string | null;
  eventName: string | null;
  fitment: FitmentResult;
  talkingPoints: TalkingPoints;
  cached: boolean;
};

// Lightweight prospect meta streamed during /api/scan (before "done").
export type ProspectMeta = {
  name: string;
  role: string;
  company: string;
};

// ── Dashboard row + list response ───────────────────────────────────────────
export type DashboardRow = {
  interaction_id: string;
  prospect_id: string;
  prospect_name: string | null;
  prospect_role: string | null;
  prospect_company: string | null;
  profile_image_url: string | null;
  linkedin_url: string;
  event_id: string | null;
  event_name: string | null;
  scanned_by_name: string | null;
  has_recording: boolean;
  transcript_status: string;
  fitment: Fitment | null;
  created_at: string;
};

export type DashboardResponse = {
  rows: DashboardRow[];
  totalScans: number;
  uniqueProspects: number;
};

// ── Event ───────────────────────────────────────────────────────────────────
export type EventWithCount = {
  id: string;
  company_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  scan_count: number;
};

export type ActiveEvent = { id: string; name: string };

// ── Interaction detail (GET /api/interaction/[id]) ──────────────────────────
export type InteractionDetail = {
  interactionId: string;
  prospectId: string;
  prospectName: string;
  prospectRole: string;
  prospectCompany: string;
  prospectImageUrl: string | null;
  prospectLinkedinUrl: string;
  eventId: string | null;
  eventName: string | null;
  images: ProspectImage[];
  fitment: FitmentResult | null;
  talkingPoints: TalkingPoints | null;
  deepDive: DeepDive | null;
  scannedByName: string | null;
  recordings: Recording[];
  hasRecording: boolean;
  transcriptStatus: string;
  transcript: string | null;
  createdAt: string;
};

// ── Stream events (NDJSON from /api/scan and /api/auth/send-code) ───────────
export type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'step'; step: string; data?: unknown }
  | { type: 'partial'; field: string; value: string }
  | {
      type: 'fitment';
      data: FitmentResult;
    }
  | { type: 'done'; data: unknown }
  | { type: 'error'; message: string }
  | { type: 'ping' };

// ── Session (local mirror of the otto_session cookie) ──────────────────────
export type Session = {
  userId: string;
  companyId: string | null;
  boothId?: string | null;
  boothSlug?: string | null;
  boothName?: string | null;
  name: string;
  email: string;
  domain?: string;
};
