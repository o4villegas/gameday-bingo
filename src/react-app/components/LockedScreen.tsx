import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { EventState } from "../../shared/types";
import { EVENTS, PERIODS_ORDER, PERIOD_CONFIG } from "../../shared/constants";

interface LockedScreenProps {
  onGoToLive: () => void;
  userPicks: string[];
  eventState: EventState;
}

export function LockedScreen({ onGoToLive, userPicks, eventState }: LockedScreenProps) {
  const hitCount = userPicks.filter((id) => eventState[id]).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 text-center">
        <div className="text-5xl mb-4">{"\u{1F512}"}</div>
        <h2 className="font-heading text-[22px] text-accent-green tracking-[2px]">
          PICKS LOCKED IN
        </h2>
        {userPicks.length > 0 && (
          <div className={cn(
            "font-heading text-lg font-bold mt-2",
            hitCount > 0 ? "text-accent-green" : "text-white/20"
          )}>
            {hitCount}/{userPicks.length} HIT
          </div>
        )}
        <p className="mt-3 text-white/50 text-sm leading-relaxed">
          Head to the{" "}
          <Button
            variant="link"
            onClick={onGoToLive}
            className="px-0 text-sm text-primary underline underline-offset-4"
          >
            Live Board
          </Button>{" "}
          to track all events during the game.
        </p>
      </div>

      {/* Period-grouped picks */}
      {PERIODS_ORDER.map((period) => {
        const config = PERIOD_CONFIG[period];
        const pickedEvents = EVENTS.filter(
          (e) => e.period === period && userPicks.includes(e.id)
        );
        if (pickedEvents.length === 0) return null;

        return (
          <div key={period} className="mx-4 my-2.5">
            <div
              className="font-heading text-xs font-semibold tracking-[2px] py-2 pb-1 border-b mb-1"
              style={{ color: config.color, borderBottomColor: config.border }}
            >
              {config.emoji} {config.label}
            </div>
            {pickedEvents.map((ev) => {
              const hit = !!eventState[ev.id];
              return (
                <div
                  key={ev.id}
                  className={cn(
                    "flex items-center px-2 py-2.5 min-h-[2.75rem]",
                    "border-b border-white/[0.03]",
                    "transition-all duration-200 ease-in-out",
                    hit && "bg-accent-green/[0.08]",
                    hit ? "border-l-2 border-l-accent-green" : "border-l-2 border-l-primary/40"
                  )}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full mr-2.5 shrink-0",
                      "flex items-center justify-center",
                      "text-xs font-bold",
                      "transition-all duration-300 ease-in-out",
                      hit
                        ? "bg-accent-green text-black"
                        : "bg-overlay-medium text-white/20"
                    )}
                  >
                    {hit ? "\u2713" : "\u00B7"}
                  </div>
                  <div
                    className={cn(
                      "flex-1 text-sm transition-all duration-300 ease-in-out",
                      hit
                        ? "text-accent-green font-semibold"
                        : "text-foreground"
                    )}
                  >
                    {ev.name}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
