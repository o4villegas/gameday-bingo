import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface RulesPageProps {
  onGoToPicks: () => void;
}

export function RulesPage({ onGoToPicks }: RulesPageProps) {
  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      {/* Title */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{"\u{1F3C8}"}</div>
        <h2 className="font-heading text-xl md:text-2xl font-bold tracking-[2px] text-white">
          HOW TO PLAY
        </h2>
        <p className="text-sm text-muted-foreground mt-1 font-body">
          Super Bowl LX Prediction Game
        </p>
      </div>

      {/* Step 1 */}
      <Section number="1" title="MAKE YOUR PICKS">
        <p>
          Choose <Strong>10 predictions</Strong> from 50 possible events across 5 game periods:
          1st Quarter, 2nd Quarter, 3rd Quarter, 4th Quarter, and Full Game.
        </p>
        <p className="mt-2">
          You must select exactly <Strong>2 events per period</Strong>. Once locked in, picks cannot
          be changed.
        </p>
      </Section>

      {/* Step 2 */}
      <Section number="2" title="WATCH & WIN EACH QUARTER">
        <p>
          After each quarter ends, our AI agent verifies which events occurred using live game data.
        </p>
        <div
          className={cn(
            "mt-3 bg-overlay-light rounded-lg border border-border p-4",
            "text-center"
          )}
        >
          <div className="font-heading text-xs tracking-[2px] text-muted-foreground mb-2">
            IN-GAME PRIZE
          </div>
          <div className="font-heading text-lg text-accent-green font-bold tracking-[1px]">
            $3 YOU CALL IT SHELL
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Awarded if ANY of your picks come true that quarter
          </div>
          <div className="text-xs text-white/40 mt-1">
            Max 1 shell per quarter &middot; 4 quarters = 4 shells max
          </div>
        </div>
      </Section>

      {/* Step 3 */}
      <Section number="3" title="FINAL STANDINGS">
        <p>
          After the game, the <Strong>top 3 players</Strong> with the most correct predictions win
          tab discounts. Ties broken by earliest submission.
        </p>
        <div className="mt-3 space-y-2">
          <PrizeRow emoji={"\u{1F947}"} place="1ST PLACE" prize="20% OFF TAB" color="text-yellow-400" />
          <PrizeRow emoji={"\u{1F948}"} place="2ND PLACE" prize="15% OFF TAB" color="text-gray-300" />
          <PrizeRow emoji={"\u{1F949}"} place="3RD PLACE" prize="10% OFF TAB" color="text-amber-600" />
        </div>
      </Section>

      {/* CTA */}
      <div className="mt-8 mb-4">
        <Button
          onClick={onGoToPicks}
          className="w-full h-12 font-heading text-sm tracking-[2px]"
        >
          {"\u270D\uFE0F"} MAKE YOUR PICKS
        </Button>
      </div>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "inline-flex items-center justify-center size-6 rounded-full",
            "bg-primary/20 text-primary font-heading text-xs font-bold"
          )}
        >
          {number}
        </span>
        <h3 className="font-heading text-sm tracking-[2px] text-white font-bold">
          {title}
        </h3>
      </div>
      <div className="text-sm text-muted-foreground font-body leading-relaxed pl-8">
        {children}
      </div>
    </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-white font-medium">{children}</span>;
}

function PrizeRow({ emoji, place, prize, color }: { emoji: string; place: string; prize: string; color: string }) {
  return (
    <div className="flex items-center bg-overlay-light rounded-lg border border-border px-4 py-2.5">
      <span className="text-lg mr-3">{emoji}</span>
      <span className={cn("font-heading text-xs tracking-[2px] font-bold flex-1", color)}>
        {place}
      </span>
      <span className="font-heading text-xs tracking-[1px] text-white">
        {prize}
      </span>
    </div>
  );
}
