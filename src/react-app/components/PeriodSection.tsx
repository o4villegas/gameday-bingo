import { useState } from "react";
import type { GameEvent, PeriodConfig, Period } from "../../shared/types";
import { MAX_PICKS_PER_PERIOD } from "../../shared/constants";
import { cn } from "@/lib/utils";
import { EventRow } from "./EventRow";

interface PeriodSectionProps {
  period: Period;
  config: PeriodConfig;
  events: GameEvent[];
  selectedPicks: string[];
  onTogglePick: (id: string) => void;
}

export function PeriodSection({ period, config, events, selectedPicks, onTogglePick }: PeriodSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Count how many picks from this period are selected
  const eventIds = new Set(events.map((e) => e.id));
  const picksInPeriod = selectedPicks.filter((p) => eventIds.has(p)).length;

  return (
    <div className="mx-4 my-2" key={period}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border px-3.5 py-3 select-none hover:brightness-110 transition-[filter] duration-150 min-h-[2.75rem]"
        style={{ background: config.bg, borderColor: config.border }}
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <div className="text-left">
          <div className="font-heading text-sm font-bold tracking-[2px]" style={{ color: config.color }}>
            {config.emoji} {config.label}
          </div>
          <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
            {config.subtitle}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {picksInPeriod > 0 && (
            <span
              className="rounded-[10px] px-2 py-0.5 text-[0.6875rem] font-heading font-bold text-black"
              style={{ background: config.color }}
            >
              {picksInPeriod}
            </span>
          )}
          <span
            className={cn(
              "text-lg text-white/30 transition-transform duration-200",
              collapsed ? "rotate-0" : "rotate-180"
            )}
          >
            &#x25BE;
          </span>
        </div>
      </button>

      {!collapsed && (
        <div className="mt-1">
          {events.map((ev) => {
            const picked = selectedPicks.includes(ev.id);
            const disabled = !picked && picksInPeriod >= MAX_PICKS_PER_PERIOD;
            return (
              <EventRow
                key={ev.id}
                event={ev}
                picked={picked}
                disabled={disabled}
                periodColor={config.color}
                periodBg={config.bg}
                onToggle={() => onTogglePick(ev.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
