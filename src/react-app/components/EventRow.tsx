import { cn } from "@/lib/utils";
import type { GameEvent } from "../../shared/types";

interface EventRowProps {
  event: GameEvent;
  picked: boolean;
  disabled: boolean;
  periodColor: string;
  periodBg: string;
  onToggle: () => void;
}

export function EventRow({ event, picked, disabled, periodColor, periodBg, onToggle }: EventRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) onToggle();
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={picked}
      tabIndex={0}
      className={cn(
        "flex items-center justify-between",
        "px-3.5 py-3 min-h-[2.75rem]",
        "border-b border-white/[0.04]",
        "transition-all duration-150 ease-in-out",
        "cursor-pointer select-none",
        "[-webkit-tap-highlight-color:transparent]",
        "active:scale-[0.98]",
        "hover:bg-white/5",
        disabled && "opacity-35 cursor-not-allowed"
      )}
      onClick={() => !disabled && onToggle()}
      onKeyDown={handleKeyDown}
      style={{ background: picked ? periodBg : undefined }}
    >
      <div
        className={cn("flex-1 text-sm text-foreground truncate")}
        style={{ color: picked ? periodColor : undefined, fontWeight: picked ? 600 : 400 }}
      >
        {event.name}
      </div>
      <div
        className={cn(
          "w-7 h-7 rounded-md shrink-0 ml-3",
          "border-2 flex items-center justify-center",
          "text-sm text-black font-bold",
          "transition-all duration-150 ease-in-out"
        )}
        style={{
          borderColor: picked ? periodColor : "rgba(255,255,255,0.15)",
          background: picked ? periodColor : "transparent",
        }}
      >
        {picked && "\u2713"}
      </div>
    </div>
  );
}
