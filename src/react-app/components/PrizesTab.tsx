import type { Player, EventState } from "../../shared/types";
import { TIERS_ORDER, TIER_CONFIG, MAX_PICKS } from "../../shared/constants";
import { getPlayerPrizes } from "../../shared/prizes";
import { PlayerCard } from "./PlayerCard";

interface PrizesTabProps {
  players: Player[];
  eventState: EventState;
}

export function PrizesTab({ players, eventState }: PrizesTabProps) {
  const leaderboard = players
    .map((p) => getPlayerPrizes(p, eventState))
    .sort((a, b) => b.correctCount - a.correctCount || a.ts - b.ts);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Prize explanation */}
      <div className="px-4 pt-5 pb-2">
        <div className="font-heading text-xs tracking-[3px] text-white/30 mb-3 text-center">
          HOW PRIZES WORK
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TIERS_ORDER.map((t) => (
            <div
              key={t}
              className="border rounded-lg px-3 py-2.5 text-center"
              style={{ background: TIER_CONFIG[t].bg, borderColor: TIER_CONFIG[t].border }}
            >
              <div
                className="font-heading text-[0.6875rem] tracking-[2px] font-bold"
                style={{ color: TIER_CONFIG[t].color }}
              >
                {TIER_CONFIG[t].emoji} {TIER_CONFIG[t].label}
              </div>
              <div className="text-xs text-white font-semibold mt-1">
                {TIER_CONFIG[t].prize}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[0.6875rem] text-white/30 text-center mt-2 font-heading tracking-[1px]">
          {MAX_PICKS} PICKS &middot; PRIZES STACK &middot; MAX 50% OFF TAB
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 py-3">
        <div className="font-heading text-xs tracking-[3px] text-white/30 mb-3 text-center">
          {"\u{1F3C6}"} LEADERBOARD
        </div>
        {players.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No players yet. Be the first!
          </div>
        ) : (
          leaderboard.map((player, i) => (
            <PlayerCard key={player.name + player.ts} player={player} rank={i} eventState={eventState} />
          ))
        )}
      </div>
    </div>
  );
}
