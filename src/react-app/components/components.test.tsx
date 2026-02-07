import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "./Header";
import { PickCounter } from "./PickCounter";
import { EventRow } from "./EventRow";
import { LiveEventRow } from "./LiveEventRow";
import { LiveBoard } from "./LiveBoard";
import { PrizesTab } from "./PrizesTab";
import { PlayerCard } from "./PlayerCard";
import { AdminEventRow } from "./AdminEventRow";
import { LockedScreen } from "./LockedScreen";
import type { GameEvent, PlayerWithScore } from "../../shared/types";

// ===== Header =====
describe("Header", () => {
  it("renders player count and branding", () => {
    render(<Header playerCount={5} totalHits={2} />);
    expect(screen.getByText("SUPER BOWL LX")).toBeInTheDocument();
    expect(screen.getByText("KAVA CULTURE PRESENTS")).toBeInTheDocument();
    expect(screen.getByText(/5 PLAYERS REGISTERED/)).toBeInTheDocument();
    expect(screen.getByText(/2 EVENTS HIT/)).toBeInTheDocument();
  });

  it("shows singular PLAYER for count 1", () => {
    render(<Header playerCount={1} totalHits={0} />);
    expect(screen.getByText(/1 PLAYER REGISTERED/)).toBeInTheDocument();
  });

  it("hides event hits when totalHits is 0", () => {
    render(<Header playerCount={0} totalHits={0} />);
    expect(screen.queryByText(/EVENT/)).not.toBeInTheDocument();
  });
});

// ===== PickCounter =====
describe("PickCounter", () => {
  it("shows SELECT X MORE when not full", () => {
    render(<PickCounter selectedPicks={["q1_opening_kick_td", "q2_pick_six"]} />);
    expect(screen.getByText("SELECT 8 MORE")).toBeInTheDocument();
    expect(screen.getByText("2/10")).toBeInTheDocument();
  });

  it("shows READY TO SUBMIT when full", () => {
    const picks = [
      "q1_opening_kick_td", "q1_safety_first_play",
      "q2_pick_six", "q2_tied_halftime",
      "q3_first_drive_td", "q3_lead_change",
      "q4_2pt_attempted", "q4_overtime",
      "fg_gatorade_orange", "fg_margin_3"
    ];
    render(<PickCounter selectedPicks={picks} />);
    expect(screen.getByText(/READY TO SUBMIT/)).toBeInTheDocument();
    expect(screen.getByText("10/10")).toBeInTheDocument();
  });

  it("shows per-period progress badges", () => {
    render(<PickCounter selectedPicks={["q1_opening_kick_td", "q1_safety_first_play"]} />);
    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });
});

// ===== EventRow =====
describe("EventRow", () => {
  const event: GameEvent = { id: "q1_opening_kick_td", name: "Opening Kickoff Returned for TD", period: "Q1" };

  it("renders event name", () => {
    render(<EventRow event={event} picked={false} disabled={false} periodColor="#ff2d55" periodBg="rgba(255,45,85,0.08)" onToggle={() => {}} />);
    expect(screen.getByText("Opening Kickoff Returned for TD")).toBeInTheDocument();
  });

  it("shows checkmark when picked", () => {
    render(<EventRow event={event} picked={true} disabled={false} periodColor="#ff2d55" periodBg="rgba(255,45,85,0.08)" onToggle={() => {}} />);
    expect(screen.getByText("\u2713")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const handler = vi.fn();
    render(<EventRow event={event} picked={false} disabled={false} periodColor="#ff2d55" periodBg="rgba(255,45,85,0.08)" onToggle={handler} />);
    fireEvent.click(screen.getByText("Opening Kickoff Returned for TD"));
    expect(handler).toHaveBeenCalled();
  });

  it("does not call onToggle when disabled", () => {
    const handler = vi.fn();
    render(<EventRow event={event} picked={false} disabled={true} periodColor="#ff2d55" periodBg="rgba(255,45,85,0.08)" onToggle={handler} />);
    fireEvent.click(screen.getByText("Opening Kickoff Returned for TD"));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ===== LiveEventRow =====
describe("LiveEventRow", () => {
  const event: GameEvent = { id: "q2_pick_six", name: "Pick-Six Thrown in Q2", period: "Q2" };

  it("renders event name", () => {
    render(<LiveEventRow event={event} hit={false} />);
    expect(screen.getByText("Pick-Six Thrown in Q2")).toBeInTheDocument();
  });

  it("shows dot indicator when not hit", () => {
    render(<LiveEventRow event={event} hit={false} />);
    expect(screen.getByText("\u00B7")).toBeInTheDocument();
  });

  it("shows check indicator when hit", () => {
    render(<LiveEventRow event={event} hit={true} />);
    expect(screen.getByText("\u2713")).toBeInTheDocument();
  });
});

// ===== LiveBoard =====
describe("LiveBoard", () => {
  it("renders all 50 events", () => {
    render(<LiveBoard eventState={{}} totalHits={0} />);
    expect(screen.getByText("Opening Kickoff Returned for TD")).toBeInTheDocument();
    expect(screen.getByText("Gatorade Bath Color Is ORANGE")).toBeInTheDocument();
  });

  it("shows hit count when events are hit", () => {
    render(<LiveBoard eventState={{ q4_overtime: true, q1_opening_kick_td: true }} totalHits={2} />);
    expect(screen.getByText("2 EVENTS HIT")).toBeInTheDocument();
  });

  it("shows AUTO-REFRESHING label", () => {
    render(<LiveBoard eventState={{}} totalHits={0} />);
    expect(screen.getByText(/AUTO-REFRESHING/)).toBeInTheDocument();
  });
});

// ===== PlayerCard =====
describe("PlayerCard", () => {
  const player: PlayerWithScore = {
    name: "Alice",
    picks: [
      "q1_opening_kick_td", "q1_safety_first_play",
      "q2_pick_six", "q2_tied_halftime",
      "q3_first_drive_td", "q3_lead_change",
      "q4_2pt_attempted", "q4_overtime",
      "fg_gatorade_orange", "fg_margin_3"
    ],
    tiebreaker: "Chiefs 28, Eagles 24",
    ts: 1000,
    correctCount: 3,
    quarterShells: 2,
    rank: 1,
    tabDiscount: 20,
    prizes: ["2× $3 YCI shells", "20% off tab (1st place)"],
  };

  it("renders player name and score", () => {
    render(<PlayerCard player={player} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument();
  });

  it("shows rank badge for top 3", () => {
    render(<PlayerCard player={player} />);
    expect(screen.getByText(/1ST/)).toBeInTheDocument();
    expect(screen.getByText(/🥇/)).toBeInTheDocument();
  });

  it("shows quarter shells indicator", () => {
    render(<PlayerCard player={player} />);
    expect(screen.getByText(/2\/4 QUARTER SHELLS/)).toBeInTheDocument();
  });

  it("shows prizes", () => {
    render(<PlayerCard player={player} />);
    expect(screen.getByText(/2× \$3 YCI shells \+ 20% off tab \(1st place\)/)).toBeInTheDocument();
  });

  it("shows tiebreaker", () => {
    render(<PlayerCard player={player} />);
    expect(screen.getByText("TIEBREAKER: Chiefs 28, Eagles 24")).toBeInTheDocument();
  });
});

// ===== PrizesTab =====
describe("PrizesTab", () => {
  it("renders empty state when no players", () => {
    render(<PrizesTab players={[]} eventState={{}} />);
    expect(screen.getByText("No players yet. Be the first!")).toBeInTheDocument();
  });

  it("renders prize explanation sections", () => {
    render(<PrizesTab players={[]} eventState={{}} />);
    expect(screen.getByText("HOW PRIZES WORK")).toBeInTheDocument();
    expect(screen.getByText(/IN-GAME PRIZES/)).toBeInTheDocument();
    expect(screen.getByText(/FINAL PRIZES/)).toBeInTheDocument();
  });

  it("renders leaderboard sorted by correct count", () => {
    const players = [
      {
        name: "Bob",
        picks: [
          "q1_opening_kick_td", "q1_safety_first_play",
          "q2_pick_six", "q2_tied_halftime",
          "q3_first_drive_td", "q3_lead_change",
          "q4_2pt_attempted", "q4_overtime",
          "fg_gatorade_orange", "fg_margin_3"
        ],
        tiebreaker: "",
        ts: 1000
      },
      {
        name: "Alice",
        picks: [
          "q1_opening_kick_td", "q1_safety_first_play",
          "q2_pick_six", "q2_tied_halftime",
          "q3_first_drive_td", "q3_lead_change",
          "q4_2pt_attempted", "q4_overtime",
          "fg_gatorade_orange", "fg_margin_3"
        ],
        tiebreaker: "",
        ts: 2000
      },
    ];
    const eventState = { q1_opening_kick_td: true, q2_pick_six: true };

    render(<PrizesTab players={players} eventState={eventState} />);

    // Both have 2 correct, Bob submitted first (ts: 1000) so Bob should be first
    const names = screen.getAllByText(/Bob|Alice/);
    expect(names[0].textContent).toContain("Bob");
  });
});

// ===== AdminEventRow =====
describe("AdminEventRow", () => {
  const event: GameEvent = { id: "q4_overtime", name: "Game Goes to Overtime", period: "Q4" };

  it("renders event name", () => {
    render(<AdminEventRow event={event} hit={false} onToggle={() => {}} />);
    expect(screen.getByText("Game Goes to Overtime")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const handler = vi.fn();
    render(<AdminEventRow event={event} hit={false} onToggle={handler} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(handler).toHaveBeenCalled();
  });
});

// ===== LockedScreen =====
describe("LockedScreen", () => {
  it("renders locked message", () => {
    render(<LockedScreen onGoToLive={() => {}} userPicks={[]} eventState={{}} />);
    expect(screen.getByText("PICKS LOCKED IN")).toBeInTheDocument();
  });

  it("calls onGoToLive when link clicked", () => {
    const handler = vi.fn();
    render(<LockedScreen onGoToLive={handler} userPicks={[]} eventState={{}} />);
    fireEvent.click(screen.getByText("Live Board"));
    expect(handler).toHaveBeenCalled();
  });

  it("renders pick summary with hit/miss status", () => {
    render(
      <LockedScreen
        onGoToLive={() => {}}
        userPicks={["q1_opening_kick_td", "q1_safety_first_play"]}
        eventState={{ q1_opening_kick_td: true }}
      />
    );
    expect(screen.getByText("1/2 HIT")).toBeInTheDocument();
    expect(screen.getByText("Opening Kickoff Returned for TD")).toBeInTheDocument();
    expect(screen.getByText("Safety on First Offensive Play")).toBeInTheDocument();
  });
});
