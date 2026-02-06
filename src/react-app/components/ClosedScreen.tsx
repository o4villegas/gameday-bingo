import { cn } from "@/lib/utils";

export function ClosedScreen() {
  return (
    <div className={cn("px-6 py-[60px] text-center")}>
      <div className="text-5xl mb-4">{"\u{1F6AB}"}</div>
      <h2
        className={cn(
          "font-heading text-[22px] text-destructive tracking-[2px]"
        )}
      >
        SUBMISSIONS CLOSED
      </h2>
      <p className={cn("mt-3 text-white/50 text-sm leading-relaxed")}>
        The game has started and picks are no longer being accepted.
      </p>
    </div>
  );
}
