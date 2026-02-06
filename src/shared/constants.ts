import type { GameEvent, PeriodConfig, Period } from "./types";

// --- Game configuration ---

export const MAX_PICKS = 10;
export const MAX_PICKS_PER_PERIOD = 2;
export const MAX_NAME_LENGTH = 40;
export const POLL_INTERVAL_MS = 8000;
export const ESPN_GAME_ID = "401671889"; // Super Bowl LIX (test) — update for Super Bowl LX before game day

// --- Period ordering and config ---

export const PERIODS_ORDER: readonly Period[] = ["Q1", "Q2", "Q3", "Q4", "FG"] as const;

export const PERIOD_CONFIG: Record<Period, PeriodConfig> = {
  Q1: {
    label: "1ST QUARTER",
    subtitle: "Opening 15 Minutes",
    color: "#ff2d55",
    bg: "rgba(255,45,85,0.08)",
    border: "rgba(255,45,85,0.25)",
    emoji: "\u{1F3C8}",
  },
  Q2: {
    label: "2ND QUARTER",
    subtitle: "Highest-Scoring Quarter Historically",
    color: "#ff9500",
    bg: "rgba(255,149,0,0.08)",
    border: "rgba(255,149,0,0.25)",
    emoji: "\u{1F525}",
  },
  Q3: {
    label: "3RD QUARTER",
    subtitle: "Post-Halftime Adjustments",
    color: "#5ac8fa",
    bg: "rgba(90,200,250,0.08)",
    border: "rgba(90,200,250,0.25)",
    emoji: "\u26A1",
  },
  Q4: {
    label: "4TH QUARTER",
    subtitle: "Desperation Time",
    color: "#af52de",
    bg: "rgba(175,82,222,0.08)",
    border: "rgba(175,82,222,0.25)",
    emoji: "\u{1F4A5}",
  },
  FG: {
    label: "FULL GAME",
    subtitle: "Observable at Final Whistle",
    color: "#30d158",
    bg: "rgba(48,209,88,0.08)",
    border: "rgba(48,209,88,0.25)",
    emoji: "\u{1F3C6}",
  },
};

// --- 50 events: 10 per period ---

export const EVENTS: GameEvent[] = [
  // Q1 — First Quarter
  { id: "q1_opening_kick_td", name: "Opening Kickoff Returned for TD", period: "Q1" },
  { id: "q1_safety_first_play", name: "Safety on First Offensive Play", period: "Q1" },
  { id: "q1_first_score_fg", name: "First Score Is a Field Goal", period: "Q1" },
  { id: "q1_first_score_def_td", name: "First Score Is a Defensive/ST Touchdown", period: "Q1" },
  { id: "q1_no_points", name: "No Points Scored in Q1 (0-0)", period: "Q1" },
  { id: "q1_both_teams_score", name: "Both Teams Score in Q1", period: "Q1" },
  { id: "q1_60yd_td", name: "60+ Yard Offensive TD Play in Q1", period: "Q1" },
  { id: "q1_turnover_first_drive", name: "Turnover on First Offensive Drive", period: "Q1" },
  { id: "q1_ends_tied", name: "Q1 Ends with Score Tied", period: "Q1" },
  { id: "q1_first_td_rush", name: "First Touchdown Is a Rushing TD", period: "Q1" },

  // Q2 — Second Quarter
  { id: "q2_50yd_fg", name: "50+ Yard Field Goal Made in Q2", period: "Q2" },
  { id: "q2_pick_six", name: "Pick-Six Thrown in Q2", period: "Q2" },
  { id: "q2_tied_halftime", name: "Score Tied at Halftime", period: "Q2" },
  { id: "q2_halftime_margin_14", name: "Halftime Margin Is 14+ Points", period: "Q2" },
  { id: "q2_combined_half_34", name: "Combined Score at Halftime Exceeds 34", period: "Q2" },
  { id: "q2_no_turnovers_half", name: "Neither Team Has a Turnover in First Half", period: "Q2" },
  { id: "q2_missed_xp", name: "Missed Extra Point in First Half", period: "Q2" },
  { id: "q2_blocked_punt_fg", name: "Blocked Punt or FG in First Half", period: "Q2" },
  { id: "q2_non_qb_td_pass", name: "Non-QB Throws a TD Pass in First Half", period: "Q2" },
  { id: "q2_player_2td", name: "A Single Player Scores 2+ TDs by Halftime", period: "Q2" },

  // Q3 — Third Quarter
  { id: "q3_first_drive_td", name: "First Drive of Second Half Scores TD", period: "Q3" },
  { id: "q3_no_points", name: "No Points Scored in Q3", period: "Q3" },
  { id: "q3_lead_change", name: "Lead Changes Hands in Q3", period: "Q3" },
  { id: "q3_kick_ret_td", name: "Kickoff Return TD in Q3", period: "Q3" },
  { id: "q3_fake_punt", name: "Fake Punt Attempted in Q3", period: "Q3" },
  { id: "q3_70yd_td", name: "70+ Yard TD Play in Q3", period: "Q3" },
  { id: "q3_safety", name: "Safety Scored in Q3", period: "Q3" },
  { id: "q3_both_teams_score", name: "Both Teams Score in Q3", period: "Q3" },
  { id: "q3_fumble_lost", name: "Fumble Lost in Q3", period: "Q3" },
  { id: "q3_single_digit_margin", name: "Q3 Ends with Single-Digit Margin (1-9 pts)", period: "Q3" },

  // Q4 — Fourth Quarter
  { id: "q4_2pt_attempted", name: "Two-Point Conversion Attempted", period: "Q4" },
  { id: "q4_failed_2pt", name: "Failed Two-Point Conversion", period: "Q4" },
  { id: "q4_onside_kick", name: "Successful Onside Kick (Q4 Only)", period: "Q4" },
  { id: "q4_fake_fg", name: "Fake Field Goal Attempted in Q4", period: "Q4" },
  { id: "q4_pick_six", name: "Pick-Six Thrown in Q4", period: "Q4" },
  { id: "q4_overtime", name: "Game Goes to Overtime", period: "Q4" },
  { id: "q4_gw_field_goal", name: "Game-Winning Score Is a Field Goal", period: "Q4" },
  { id: "q4_gw_final_2min", name: "Game-Winning Score in Final 2 Minutes", period: "Q4" },
  { id: "q4_fumble_ret_td", name: "Fumble Returned for TD in Q4", period: "Q4" },
  { id: "q4_highest_scoring", name: "Q4 Is Highest-Scoring Quarter of Game", period: "Q4" },

  // FG — Full Game Highlights
  { id: "fg_gatorade_orange", name: "Gatorade Bath Color Is ORANGE", period: "FG" },
  { id: "fg_gatorade_blue", name: "Gatorade Bath Color Is BLUE", period: "FG" },
  { id: "fg_gatorade_clear", name: "Gatorade Bath Is CLEAR/WATER", period: "FG" },
  { id: "fg_no_gatorade", name: "NO Gatorade Bath Occurs", period: "FG" },
  { id: "fg_margin_3", name: "Final Margin Exactly 3 Points", period: "FG" },
  { id: "fg_margin_7", name: "Final Margin Exactly 7 Points", period: "FG" },
  { id: "fg_blowout", name: "Blowout \u2014 Winning Margin 17+ Points", period: "FG" },
  { id: "fg_loser_single_digits", name: "Losing Team Held to Single Digits (\u22649 pts)", period: "FG" },
  { id: "fg_zero_turnovers", name: "Zero Turnovers Entire Game (Both Teams)", period: "FG" },
  { id: "fg_combined_over_55", name: "Combined Final Score Exceeds 55 Points", period: "FG" },
];
