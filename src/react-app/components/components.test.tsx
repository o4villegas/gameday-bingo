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
import type { GameEvent, PlayerWithPrizes } from "../../shared/types";

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
    render(<PickCounter selectedCount={2} />);
    expect(screen.getByText("SELECT 3 MORE")).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("shows READY TO SUBMIT when full", () => {
    render(<PickCounter selectedCount={5} />);
    expect(screen.getByText(/READY TO SUBMIT/)).toBeInTheDocument();
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });
});

// ===== EventRow =====
describe("EventRow", () => {
  const event: GameEvent = { id: "t1_pick_six", name: "Pick-Six", tier: 1 };

  it("renders event name", () => {
    render(<EventRow event={event} picked={false} disabled={false} tierColor="#30d158" tierBg="rgba(48,209,88,0.08)" onToggle={() => {}} />);
    expect(screen.getByText("Pick-Six")).toBeInTheDocument();
  });

  it("shows checkmark when picked", () => {
    render(<EventRow event={event} picked={true} disabled={false} tierColor="#30d158" tierBg="rgba(48,209,88,0.08)" onToggle={() => {}} />);
    expect(screen.getByText("\u2713")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const handler = vi.fn();
    render(<EventRow event={event} picked={false} disabled={false} tierColor="#30d158" tierBg="rgba(48,209,88,0.08)" onToggle={handler} />);
    fireEvent.click(screen.getByText("Pick-Six"));
    expect(handler).toHaveBeenCalled();
  });

  it("does not call onToggle when disabled", () => {
    const handler = vi.fn();
    render(<EventRow event={event} picked={false} disabled={true} tierColor="#30d158" tierBg="rgba(48,209,88,0.08)" onToggle={handler} />);
    fireEvent.click(screen.getByText("Pick-Six"));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ===== LiveEventRow =====
describe("LiveEventRow", () => {
  const event: GameEvent = { id: "t2_safety", name: "Safety Scored", tier: 2 };

  it("renders event name", () => {
    render(<LiveEventRow event={event} hit={false} />);
    expect(screen.getByText("Safety Scored")).toBeInTheDocument();
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
  it("renders all 30 events", () => {
    render(<LiveBoard eventState={{}} totalHits={0} />);
    expect(screen.getByText("Punt Return Touchdown")).toBeInTheDocument();
    expect(screen.getByText("Missed Field Goal (Any)")).toBeInTheDocument();
  });

  it("shows hit count when events are hit", () => {
    render(<LiveBoard eventState={{ t4_overtime: true, t1_pick_six: true }} totalHits={2} />);
    expect(screen.getByText("2 EVENTS HIT")).toBeInTheDocument();
  });

  it("shows AUTO-REFRESHING label", () => {
    render(<LiveBoard eventState={{}} totalHits={0} />);
    expect(screen.getByText(/AUTO-REFRESHING/)).toBeInTheDocument();
  });
});

// ===== PlayerCard =====
describe("PlayerCard", () => {
  const player: PlayerWithPrizes = {
    name: "Alice",
    picks: ["t4_overtime", "t2_safety", "t1_pick_six", "t1_blowout", "t3_blocked_punt"],
    tiebreaker: "Chiefs 28",
    ts: 1000,
    correctCount: 2,
    prizes: ["50% off tab", "1 free YCI shell"],
    tabDiscount: 50,
    freeShells: 1,
    shells3: 0,
  };

  it("renders player name and score", () => {
    render(<PlayerCard player={player} rank={0} eventState={{ t4_overtime: true, t2_safety: true }} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("shows crown for rank 0 with hits", () => {
    render(<PlayerCard player={player} rank={0} eventState={{ t4_overtime: true }} />);
    expect(screen.getByText(/\u{1F451}/u)).toBeInTheDocument();
  });

  it("shows prizes", () => {
    render(<PlayerCard player={player} rank={0} eventState={{}} />);
    expect(screen.getByText(/50% off tab \+ 1 free YCI shell/)).toBeInTheDocument();
  });

  it("shows tiebreaker", () => {
    render(<PlayerCard player={player} rank={0} eventState={{}} />);
    expect(screen.getByText("TIEBREAKER: Chiefs 28")).toBeInTheDocument();
  });
});

// ===== PrizesTab =====
describe("PrizesTab", () => {
  it("renders empty state when no players", () => {
    render(<PrizesTab players={[]} eventState={{}} />);
    expect(screen.getByText("No players yet. Be the first!")).toBeInTheDocument();
  });

  it("renders prize tier grid", () => {
    render(<PrizesTab players={[]} eventState={{}} />);
    expect(screen.getByText("HOW PRIZES WORK")).toBeInTheDocument();
    expect(screen.getByText("50% OFF TAB")).toBeInTheDocument();
    expect(screen.getByText("FREE YCI SHELL")).toBeInTheDocument();
  });

  it("renders leaderboard sorted by correct count", () => {
    const players = [
      { name: "Bob", picks: ["t4_overtime", "t2_safety", "t1_pick_six", "t1_blowout", "t3_blocked_punt"], tiebreaker: "", ts: 1000 },
      { name: "Alice", picks: ["t4_overtime", "t2_safety", "t1_pick_six", "t1_blowout", "t3_blocked_punt"], tiebreaker: "", ts: 2000 },
    ];
    const eventState = { t4_overtime: true, t2_safety: true };

    render(<PrizesTab players={players} eventState={eventState} />);

    // Both have 2 correct, Bob submitted first (ts: 1000) so Bob should be first
    const names = screen.getAllByText(/Bob|Alice/);
    expect(names[0].textContent).toContain("Bob");
  });
});

// ===== AdminEventRow =====
describe("AdminEventRow", () => {
  const event: GameEvent = { id: "t4_overtime", name: "Game Goes to Overtime", tier: 4 };

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
    render(<LockedScreen onGoToLive={() => {}} />);
    expect(screen.getByText("PICKS LOCKED IN")).toBeInTheDocument();
  });

  it("calls onGoToLive when link clicked", () => {
    const handler = vi.fn();
    render(<LockedScreen onGoToLive={handler} />);
    fireEvent.click(screen.getByText("Live Board"));
    expect(handler).toHaveBeenCalled();
  });
});
