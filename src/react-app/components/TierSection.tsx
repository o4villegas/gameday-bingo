import { useState } from "react";
import type { GameEvent, TierConfig } from "../../shared/types";
import { MAX_PICKS } from "../../shared/constants";
import { cn } from "@/lib/utils";
import { EventRow } from "./EventRow";

interface TierSectionProps {
  tier: number;
  config: TierConfig;
  events: GameEvent[];
  selectedPicks: string[];
  onTogglePick: (id: string) => void;
}

export function TierSection({ tier, config, events, selectedPicks, onTogglePick }: TierSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pickedInTier = selectedPicks.filter((p) => events.some((e) => e.id === p)).length;

  return (
    <div className="mx-4 my-2" key={tier}>
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
            {config.subtitle} &mdash; <span style={{ color: config.color }}>{config.prize}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pickedInTier > 0 && (
            <span
              className="rounded-[10px] px-2 py-0.5 text-[0.6875rem] font-heading font-bold text-black"
              style={{ background: config.color }}
            >
              {pickedInTier}
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
            const disabled = !picked && selectedPicks.length >= MAX_PICKS;
            return (
              <EventRow
                key={ev.id}
                event={ev}
                picked={picked}
                disabled={disabled}
                tierColor={config.color}
                tierBg={config.bg}
                onToggle={() => onTogglePick(ev.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
