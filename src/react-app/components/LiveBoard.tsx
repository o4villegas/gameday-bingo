import type { EventState } from "../../shared/types";
import { EVENTS, PERIODS_ORDER, PERIOD_CONFIG } from "../../shared/constants";
import { LiveEventRow } from "./LiveEventRow";

interface LiveBoardProps {
  eventState: EventState;
  totalHits: number;
  userPicks?: string[];
}

export function LiveBoard({ eventState, totalHits, userPicks = [] }: LiveBoardProps) {
  const userHits = userPicks.filter((id) => eventState[id]).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="px-4 pt-3.5 pb-1 text-center">
        <div className="font-heading text-[0.6875rem] tracking-[3px] text-white/30">
          {"\u{1F4E1}"} AUTO-REFRESHING
        </div>
        {totalHits > 0 && (
          <div className="font-heading text-lg font-bold text-accent-green mt-1.5">
            {totalHits} EVENT{totalHits !== 1 ? "S" : ""} HIT
          </div>
        )}
        {userPicks.length > 0 && (
          <div className="font-heading text-sm text-primary mt-1">
            YOUR PICKS: {userHits}/{userPicks.length} HIT
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:px-4">
        {PERIODS_ORDER.map((period) => {
          const config = PERIOD_CONFIG[period];
          const events = EVENTS.filter((e) => e.period === period);
          const hitCount = events.filter((e) => eventState[e.id]).length;

          return (
            <div key={period} className="mx-4 my-2.5 lg:mx-0">
              <div
                className="font-heading text-xs font-semibold tracking-[2px] py-2 pb-1 border-b mb-1 flex justify-between items-center"
                style={{ color: config.color, borderBottomColor: config.border }}
              >
                <span>{config.emoji} {config.label}</span>
                {hitCount > 0 && (
                  <span className="bg-accent-green text-black rounded-[10px] px-2 py-px text-[0.625rem] font-bold">
                    {hitCount} HIT
                  </span>
                )}
              </div>
              {events.map((ev) => (
                <LiveEventRow
                  key={ev.id}
                  event={ev}
                  hit={!!eventState[ev.id]}
                  isPicked={userPicks.includes(ev.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
