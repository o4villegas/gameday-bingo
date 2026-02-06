import type { Player, EventState } from "../../shared/types";
import { MAX_PICKS } from "../../shared/constants";
import { rankPlayers } from "../../shared/prizes";
import { PlayerCard } from "./PlayerCard";

interface PrizesTabProps {
  players: Player[];
  eventState: EventState;
}

export function PrizesTab({ players, eventState }: PrizesTabProps) {
  const leaderboard = rankPlayers(players, eventState);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Prize explanation */}
      <div className="px-4 pt-5 pb-2">
        <div className="font-heading text-xs tracking-[3px] text-white/30 mb-3 text-center">
          HOW PRIZES WORK
        </div>

        {/* In-game prizes */}
        <div className="border rounded-lg px-4 py-3 mb-3 bg-primary/5 border-primary/20">
          <div className="font-heading text-xs tracking-[2px] text-primary font-bold mb-2">
            {"\u{1F525}"} IN-GAME PRIZES (QUARTERS)
          </div>
          <div className="text-[0.6875rem] text-white/70 leading-relaxed">
            For each game quarter (Q1, Q2, Q3, Q4), if ANY of your picks in that quarter hit, you earn 1× $3 YCI shell.
            <br />
            <span className="text-white/50">Max: 4 shells ($12 value)</span>
          </div>
        </div>

        {/* Final prizes */}
        <div className="border rounded-lg px-4 py-3 bg-accent-green/5 border-accent-green/20">
          <div className="font-heading text-xs tracking-[2px] text-accent-green font-bold mb-2">
            {"\u{1F3C6}"} FINAL PRIZES (TOP 3)
          </div>
          <div className="text-[0.6875rem] text-white/70 leading-relaxed space-y-1">
            <div><span className="text-accent-green font-bold">1st place:</span> 20% off your tab</div>
            <div><span className="text-accent-green font-bold">2nd place:</span> 15% off your tab</div>
            <div><span className="text-accent-green font-bold">3rd place:</span> 10% off your tab</div>
          </div>
        </div>

        <div className="text-[0.6875rem] text-white/30 text-center mt-2 font-heading tracking-[1px]">
          {MAX_PICKS} PICKS &middot; PRIZES STACK &middot; TIEBREAKER: EARLIER SUBMISSION
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
          leaderboard.map((player) => (
            <PlayerCard key={player.name + player.ts} player={player} eventState={eventState} />
          ))
        )}
      </div>
    </div>
  );
}
