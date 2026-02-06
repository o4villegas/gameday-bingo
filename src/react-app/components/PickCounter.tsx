import { cn } from "@/lib/utils";
import type { Period } from "../../shared/types";
import { MAX_PICKS, MAX_PICKS_PER_PERIOD, EVENTS, PERIODS_ORDER, PERIOD_CONFIG } from "../../shared/constants";

interface PickCounterProps {
  selectedPicks: string[];
}

export function PickCounter({ selectedPicks }: PickCounterProps) {
  const selectedCount = selectedPicks.length;
  const ready = selectedCount === MAX_PICKS;

  // Build eventId → period lookup
  const eventPeriodMap = new Map<string, Period>();
  for (const ev of EVENTS) {
    eventPeriodMap.set(ev.id, ev.period);
  }

  // Count picks per period
  const periodCounts = new Map<string, number>();
  for (const period of PERIODS_ORDER) {
    periodCounts.set(period, 0);
  }
  for (const pickId of selectedPicks) {
    const period = eventPeriodMap.get(pickId);
    if (period && periodCounts.has(period)) {
      periodCounts.set(period, periodCounts.get(period)! + 1);
    }
  }

  return (
    <div
      data-testid="pick-counter"
      className={cn(
        "px-4 pt-3 pb-2",
        "sticky top-[var(--tab-height)] z-50",
        "bg-background"
      )}
    >
      {/* Per-period progress badges */}
      <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap">
        {PERIODS_ORDER.map((period) => {
          const count = periodCounts.get(period) || 0;
          const config = PERIOD_CONFIG[period];
          const filled = count >= MAX_PICKS_PER_PERIOD;

          return (
            <div
              key={period}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 border text-[0.625rem] font-heading font-bold tracking-[1px] transition-all duration-200",
                filled
                  ? "border-white/20 opacity-100"
                  : count > 0
                  ? "border-white/10 opacity-70"
                  : "border-white/5 opacity-40"
              )}
              style={{
                background: filled ? config.bg : "transparent",
                borderColor: filled ? config.border : undefined,
              }}
            >
              <span style={{ color: filled ? config.color : "rgba(255,255,255,0.4)" }}>
                {period}
              </span>
              <span className={cn(filled ? "text-white" : "text-white/30")}>
                {count}/{MAX_PICKS_PER_PERIOD}
              </span>
            </div>
          );
        })}
      </div>

      {/* Overall counter */}
      <div
        aria-live="polite"
        className={cn(
          "flex items-center justify-between",
          "rounded-lg px-3.5 py-2.5",
          "border transition-all duration-300 ease-in-out",
          ready
            ? "bg-accent-green/10 border-accent-green/30"
            : "bg-primary/10 border-primary/30"
        )}
      >
        <span
          className={cn(
            "font-heading text-[13px] tracking-[2px]",
            ready ? "text-accent-green" : "text-primary"
          )}
        >
          {ready ? "READY TO SUBMIT \u2713" : `SELECT ${MAX_PICKS - selectedCount} MORE`}
        </span>
        <span
          className={cn(
            "font-heading text-xl font-bold",
            ready ? "text-accent-green" : "text-primary"
          )}
        >
          {selectedCount}/{MAX_PICKS}
        </span>
      </div>
    </div>
  );
}
