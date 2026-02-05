import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlayerWithPrizes, EventState } from "../../shared/types";
import { EVENTS, MAX_PICKS } from "../../shared/constants";

interface PlayerCardProps {
  player: PlayerWithPrizes;
  rank: number;
  eventState: EventState;
}

export function PlayerCard({ player, rank, eventState }: PlayerCardProps) {
  return (
    <Card className="bg-overlay-light border-border rounded-lg p-0 gap-0 mb-2 shadow-none">
      <CardContent className="px-3.5 py-3">
        {/* Header row */}
        <div className="flex justify-between items-center">
          <span
            className={cn(
              "font-heading text-[15px] font-semibold text-white tracking-[1px]",
              "truncate max-w-[12.5rem]"
            )}
          >
            {rank === 0 && player.correctCount > 0 ? "\u{1F451} " : ""}{player.name}
          </span>
          <span
            className={cn(
              "font-heading text-xl font-bold",
              player.correctCount > 0
                ? "text-accent-green"
                : "text-white/20"
            )}
          >
            {player.correctCount}/{MAX_PICKS}
          </span>
        </div>

        {/* Picks */}
        <div className="mt-2 flex flex-wrap gap-1">
          {player.picks.map((pickId) => {
            const ev = EVENTS.find((e) => e.id === pickId);
            if (!ev) return null;
            const hit = !!eventState[pickId];
            return (
              <Badge
                key={pickId}
                variant="outline"
                className={cn(
                  "font-heading text-[10px] tracking-[1px]",
                  "px-2 py-0.5 rounded",
                  hit
                    ? "bg-accent-green/20 text-accent-green border-accent-green/30"
                    : "bg-white/5 text-white/40 border-border"
                )}
              >
                {hit ? "\u2713 " : ""}{ev.name}
              </Badge>
            );
          })}
        </div>

        {/* Prizes */}
        {player.prizes.length > 0 ? (
          <div className="mt-2 text-[13px] text-primary font-semibold">
            {"\u{1F389}"} {player.prizes.join(" + ")}
          </div>
        ) : (
          <div className="mt-2 text-xs text-white/20 font-heading tracking-[1px]">
            NO PRIZES YET
          </div>
        )}

        {/* Tiebreaker */}
        {player.tiebreaker && (
          <div className="mt-1 text-[11px] text-white/25 font-heading tracking-[1px]">
            TIEBREAKER: {player.tiebreaker}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
