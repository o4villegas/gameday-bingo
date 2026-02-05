export interface GameEvent {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
}

export interface TierConfig {
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  prize: string;
  emoji: string;
}

export type EventState = Record<string, boolean>;

export interface Player {
  name: string;
  picks: string[];
  tiebreaker: string;
  ts: number;
}

export interface PlayerWithPrizes extends Player {
  correctCount: number;
  prizes: string[];
  tabDiscount: number;
  freeShells: number;
  shells3: number;
}

export type TabId = "picks" | "live" | "prizes" | "admin";
