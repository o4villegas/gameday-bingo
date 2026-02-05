import { cn } from "@/lib/utils";
import type { GameEvent } from "../../shared/types";

interface LiveEventRowProps {
  event: GameEvent;
  hit: boolean;
}

export function LiveEventRow({ event, hit }: LiveEventRowProps) {
  return (
    <div
      className={cn(
        "flex items-center",
        "px-2 py-2.5 min-h-[2.75rem]",
        "border-b border-white/[0.03]",
        "transition-all duration-200 ease-in-out",
        "hover:bg-overlay-hover",
        hit && "bg-accent-green/[0.08]"
      )}
    >
      <div
        aria-label={hit ? "Event hit" : "Event not hit"}
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
        {event.name}
      </div>
    </div>
  );
}
