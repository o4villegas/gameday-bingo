import { cn } from "@/lib/utils";

interface HeaderProps {
  playerCount: number;
  totalHits: number;
}

export function Header({ playerCount, totalHits }: HeaderProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-b from-secondary to-background",
        "border-b border-border",
        "px-4 pt-5 pb-3 md:px-6 md:pt-6 md:pb-4 lg:px-8 lg:pt-8 lg:pb-5",
        "text-center"
      )}
    >
      <div
        className={cn(
          "font-heading text-[11px] md:text-xs lg:text-sm",
          "tracking-[6px] text-primary font-medium mb-1"
        )}
      >
        KAVA CULTURE PRESENTS
      </div>
      <h1
        className={cn(
          "font-heading text-[28px] md:text-[32px] lg:text-4xl",
          "font-bold tracking-[2px] text-white leading-[1.1]"
        )}
      >
        SUPER BOWL LX
      </h1>
      <div
        className={cn(
          "font-heading text-[13px] md:text-sm lg:text-base",
          "tracking-[3px] text-muted-foreground mt-0.5"
        )}
      >
        HARD MODE PREDICTIONS
      </div>
      <div
        className={cn(
          "mt-2 text-[11px] md:text-xs lg:text-sm",
          "text-white/25 font-heading tracking-[1px]"
        )}
      >
        {playerCount} PLAYER{playerCount !== 1 ? "S" : ""} REGISTERED
        {totalHits > 0 && <> &middot; {totalHits} EVENT{totalHits !== 1 ? "S" : ""} HIT</>}
      </div>
    </div>
  );
}
