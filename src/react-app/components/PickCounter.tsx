import { cn } from "@/lib/utils";
import { MAX_PICKS } from "../../shared/constants";

interface PickCounterProps {
  selectedCount: number;
}

export function PickCounter({ selectedCount }: PickCounterProps) {
  const ready = selectedCount === MAX_PICKS;
  return (
    <div
      className={cn(
        "px-4 pt-3 pb-2",
        "sticky top-[var(--tab-height)] z-50",
        "bg-background"
      )}
    >
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
