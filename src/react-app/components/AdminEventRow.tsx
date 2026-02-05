import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { GameEvent } from "../../shared/types";

interface AdminEventRowProps {
  event: GameEvent;
  hit: boolean;
  onToggle: () => void;
}

export function AdminEventRow({ event, hit, onToggle }: AdminEventRowProps) {
  return (
    <div
      className={cn(
        "flex items-center",
        "px-3.5 py-3 min-h-[2.75rem]",
        "border-b border-white/[0.04]",
        "transition-all duration-150 ease-in-out",
        "select-none [-webkit-tap-highlight-color:transparent]"
      )}
      style={{ background: hit ? "rgba(48,209,88,0.1)" : "transparent" }}
    >
      <Switch
        checked={hit}
        onCheckedChange={onToggle}
        className="mr-2.5 shrink-0"
      />
      <div
        className={cn(
          "text-[13px]",
          hit ? "text-accent-green" : "text-foreground"
        )}
      >
        {event.name}
      </div>
    </div>
  );
}
