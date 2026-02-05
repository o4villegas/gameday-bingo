import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface LockedScreenProps {
  onGoToLive: () => void;
}

export function LockedScreen({ onGoToLive }: LockedScreenProps) {
  return (
    <div className={cn("px-6 py-[60px] text-center")}>
      <div className="text-5xl mb-4">{"\u{1F512}"}</div>
      <h2
        className={cn(
          "font-heading text-[22px] text-accent-green tracking-[2px]"
        )}
      >
        PICKS LOCKED IN
      </h2>
      <p className={cn("mt-3 text-white/50 text-sm leading-relaxed")}>
        Head to the{" "}
        <Button
          variant="link"
          onClick={onGoToLive}
          className="px-0 text-sm text-primary underline underline-offset-4"
        >
          Live Board
        </Button>{" "}
        to track events during the game.
      </p>
    </div>
  );
}
