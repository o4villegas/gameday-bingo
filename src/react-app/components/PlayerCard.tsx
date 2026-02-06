import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlayerWithScore, EventState, Period } from "../../shared/types";
import { EVENTS, MAX_PICKS, PERIODS_ORDER, PERIOD_CONFIG } from "../../shared/constants";

interface PlayerCardProps {
  player: PlayerWithScore;
  eventState: EventState;
}

export function PlayerCard({ player, eventState }: PlayerCardProps) {
  // Build eventId → period lookup
  const eventPeriodMap = new Map<string, Period>();
  for (const ev of EVENTS) {
    eventPeriodMap.set(ev.id, ev.period);
  }

  // Group picks by period
  const picksByPeriod = new Map<string, string[]>();
  for (const period of PERIODS_ORDER) {
    picksByPeriod.set(period, []);
  }
  for (const pickId of player.picks) {
    const period = eventPeriodMap.get(pickId);
    if (period && picksByPeriod.has(period)) {
      picksByPeriod.get(period)!.push(pickId);
    }
  }

  // Rank badge rendering
  const renderRankBadge = () => {
    if (!player.rank) return null;

    const rankEmojis = ["🥇", "🥈", "🥉"];
    const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
    const rankLabels = ["1ST", "2ND", "3RD"];

    const idx = player.rank - 1;
    return (
      <span
        className="text-[0.625rem] font-heading font-bold px-1.5 py-0.5 rounded ml-2"
        style={{
          background: `${rankColors[idx]}20`,
          color: rankColors[idx],
          border: `1px solid ${rankColors[idx]}40`
        }}
      >
        {rankEmojis[idx]} {rankLabels[idx]}
      </span>
    );
  };

  return (
    <Card className="bg-overlay-light border-border rounded-lg p-0 gap-0 mb-2 shadow-none">
      <CardContent className="px-3.5 py-3">
        {/* Header row */}
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span
              className={cn(
                "font-heading text-[15px] font-semibold text-white tracking-[1px]",
                "truncate max-w-[12.5rem]"
              )}
            >
              {player.name}
            </span>
            {renderRankBadge()}
          </div>
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

        {/* Quarter shells indicator */}
        {player.quarterShells > 0 && (
          <div className="mt-1.5 text-[11px] font-heading tracking-[1px] text-primary">
            {"\u{1F525}"} {player.quarterShells}/4 QUARTER SHELLS
          </div>
        )}

        {/* Picks grouped by period */}
        <div className="mt-2 space-y-1.5">
          {PERIODS_ORDER.map((period) => {
            const picks = picksByPeriod.get(period) || [];
            if (picks.length === 0) return null;

            const config = PERIOD_CONFIG[period];

            return (
              <div key={period}>
                <div className="text-[0.5625rem] font-heading tracking-[1.5px] mb-0.5 opacity-50" style={{ color: config.color }}>
                  {period}
                </div>
                <div className="flex flex-wrap gap-1">
                  {picks.map((pickId) => {
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
                        style={{
                          borderColor: !hit ? config.border : undefined,
                        }}
                      >
                        {hit ? "\u2713 " : ""}{ev.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
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
