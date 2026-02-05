import type { GameEvent, TierConfig } from "./types";

export const EVENTS: GameEvent[] = [
  // Tier 4 - Totally Unlikely (<5%) - 50% off entire tab
  { id: "t4_punt_return_td", name: "Punt Return Touchdown", tier: 4 },
  { id: "t4_opening_kick_td", name: "Opening Kickoff Returned for TD", tier: 4 },
  { id: "t4_overtime", name: "Game Goes to Overtime", tier: 4 },
  { id: "t4_onside_kick", name: "Successful Onside Kick", tier: 4 },
  { id: "t4_blocked_ret_td", name: "Blocked Punt/FG Returned for TD", tier: 4 },
  { id: "t4_fake_fg", name: "Fake Field Goal Attempted", tier: 4 },
  { id: "t4_ejection", name: "Player Ejected", tier: 4 },
  // Tier 3 - Very Unlikely (<10%) - 20% off entire tab
  { id: "t3_non_qb_td_pass", name: "Non-QB Throws a TD Pass", tier: 3 },
  { id: "t3_blocked_punt", name: "Blocked Punt", tier: 3 },
  // Tier 2 - Unlikely (<20%) - Free YCI shell
  { id: "t2_blocked_fg", name: "Blocked Field Goal", tier: 2 },
  { id: "t2_fumble_ret_td", name: "Fumble Returned for TD", tier: 2 },
  { id: "t2_margin_7", name: "Final Margin Exactly 7 Points", tier: 2 },
  { id: "t2_margin_3", name: "Final Margin Exactly 3 Points", tier: 2 },
  { id: "t2_safety", name: "Safety Scored", tier: 2 },
  { id: "t2_missed_xp", name: "Missed Extra Point", tier: 2 },
  { id: "t2_kick_ret_td", name: "Kickoff Return Touchdown", tier: 2 },
  { id: "t2_gatorade_blue", name: "Gatorade Bath: Blue", tier: 2 },
  { id: "t2_gatorade_clear", name: "Gatorade Bath: Clear/Water", tier: 2 },
  { id: "t2_no_gatorade", name: "No Gatorade Bath Occurs", tier: 2 },
  { id: "t2_50yd_fg", name: "50+ Yard Field Goal Made", tier: 2 },
  // Tier 1 - Hard But Possible (<50%) - $3 YCI shells
  { id: "t1_qb_rush_td", name: "QB Rushes for Touchdown", tier: 1 },
  { id: "t1_gatorade_orange", name: "Gatorade Bath: Orange", tier: 1 },
  { id: "t1_low_loser", name: "Losing Team Scores \u226410", tier: 1 },
  { id: "t1_pick_six", name: "Pick-Six (INT Returned for TD)", tier: 1 },
  { id: "t1_60yd_td", name: "60+ Yard Offensive TD Play", tier: 1 },
  { id: "t1_failed_2pt", name: "Failed Two-Point Conversion", tier: 1 },
  { id: "t1_blowout", name: "Blowout (Margin 17+ Points)", tier: 1 },
  { id: "t1_low_scoring", name: "Neither Team Scores 25+", tier: 1 },
  { id: "t1_2pt_attempted", name: "Two-Point Conversion Attempted", tier: 1 },
  { id: "t1_missed_fg", name: "Missed Field Goal (Any)", tier: 1 },
];

export const TIER_CONFIG: Record<number, TierConfig> = {
  4: { label: "TIER 4", subtitle: "Totally Unlikely", color: "#ff2d55", bg: "rgba(255,45,85,0.08)", border: "rgba(255,45,85,0.25)", prize: "50% OFF TAB", emoji: "\u{1F525}" },
  3: { label: "TIER 3", subtitle: "Very Unlikely", color: "#ff9500", bg: "rgba(255,149,0,0.08)", border: "rgba(255,149,0,0.25)", prize: "20% OFF TAB", emoji: "\u26A1" },
  2: { label: "TIER 2", subtitle: "Unlikely", color: "#5ac8fa", bg: "rgba(90,200,250,0.08)", border: "rgba(90,200,250,0.25)", prize: "FREE YCI SHELL", emoji: "\u{1F965}" },
  1: { label: "TIER 1", subtitle: "Hard But Possible", color: "#30d158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.25)", prize: "$3 YCI SHELL", emoji: "\u{1F33F}" },
};

export const MAX_PICKS = 5;
export const MAX_NAME_LENGTH = 40;
export const TIERS_ORDER = [4, 3, 2, 1] as const;
export const POLL_INTERVAL_MS = 8000;
