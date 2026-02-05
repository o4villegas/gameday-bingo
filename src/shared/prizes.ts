import type { Player, EventState, PlayerWithPrizes } from "./types";
import { EVENTS } from "./constants";

export function getPlayerPrizes(player: Player, eventState: EventState): PlayerWithPrizes {
  let tabDiscount = 0;
  let freeShells = 0;
  let shells3 = 0;
  const prizes: string[] = [];

  player.picks.forEach((pickId) => {
    if (eventState[pickId]) {
      const ev = EVENTS.find((e) => e.id === pickId);
      if (!ev) return;
      if (ev.tier === 4) tabDiscount += 50;
      if (ev.tier === 3) tabDiscount += 20;
      if (ev.tier === 2) freeShells++;
      if (ev.tier === 1) shells3++;
    }
  });

  tabDiscount = Math.min(tabDiscount, 50);
  if (tabDiscount > 0) prizes.push(`${tabDiscount}% off tab`);
  if (freeShells > 0) prizes.push(`${freeShells} free YCI shell${freeShells > 1 ? "s" : ""}`);
  if (shells3 > 0) prizes.push(`${shells3}\u00D7 $3 YCI shell${shells3 > 1 ? "s" : ""}`);

  const correctCount = player.picks.filter((p) => eventState[p]).length;

  return { ...player, prizes, correctCount, tabDiscount, freeShells, shells3 };
}
