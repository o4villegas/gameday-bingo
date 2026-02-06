// --- Period / Event types ---

export type Period = "Q1" | "Q2" | "Q3" | "Q4" | "FG";

export interface GameEvent {
  id: string;
  name: string;
  period: Period;
}

export interface PeriodConfig {
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  emoji: string;
}

// --- Game state ---

export type EventState = Record<string, boolean>;

// --- Player types ---

export interface Player {
  name: string;
  picks: string[];
  tiebreaker: string;
  ts: number;
}

export interface PlayerWithScore extends Player {
  correctCount: number;
  quarterShells: number;
  rank: number | null;
  tabDiscount: number;
  prizes: string[];
}

// --- Tab routing ---

export type TabId = "rules" | "picks" | "live" | "prizes" | "admin";

// --- AI Verification types ---

export interface EventVerification {
  eventId: string;
  eventName: string;
  occurred: boolean;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export interface VerificationResult {
  period: Period;
  timestamp: number;
  events: EventVerification[];
  summary: string;
  status: "completed" | "error";
  error?: string;
}

export interface VerificationState {
  pendingApproval: VerificationResult | null;
  appliedResults: VerificationResult[];
}

export interface GameState {
  gameId: string;
  periodsVerified: Period[];
}
