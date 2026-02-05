import { describe, it, expect } from "vitest";
import { EVENTS, TIER_CONFIG, MAX_PICKS, TIERS_ORDER } from "./constants";

describe("EVENTS", () => {
  it("has exactly 30 events total", () => {
    expect(EVENTS).toHaveLength(30);
  });

  it("has 7 Tier 4 events", () => {
    expect(EVENTS.filter((e) => e.tier === 4)).toHaveLength(7);
  });

  it("has 2 Tier 3 events", () => {
    expect(EVENTS.filter((e) => e.tier === 3)).toHaveLength(2);
  });

  it("has 11 Tier 2 events", () => {
    expect(EVENTS.filter((e) => e.tier === 2)).toHaveLength(11);
  });

  it("has 10 Tier 1 events", () => {
    expect(EVENTS.filter((e) => e.tier === 1)).toHaveLength(10);
  });

  it("has unique IDs for every event", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all events have non-empty names", () => {
    for (const event of EVENTS) {
      expect(event.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("all events have valid tier values (1-4)", () => {
    for (const event of EVENTS) {
      expect([1, 2, 3, 4]).toContain(event.tier);
    }
  });

  it("all event IDs follow the tN_ prefix convention", () => {
    for (const event of EVENTS) {
      expect(event.id).toMatch(/^t[1-4]_/);
      expect(event.id.startsWith(`t${event.tier}_`)).toBe(true);
    }
  });
});

describe("TIER_CONFIG", () => {
  it("has configuration for all 4 tiers", () => {
    for (const tier of [1, 2, 3, 4]) {
      expect(TIER_CONFIG[tier]).toBeDefined();
    }
  });

  it("each tier has all required fields", () => {
    for (const tier of [1, 2, 3, 4]) {
      const config = TIER_CONFIG[tier];
      expect(config.label).toBeTruthy();
      expect(config.subtitle).toBeTruthy();
      expect(config.color).toMatch(/^#/);
      expect(config.bg).toMatch(/^rgba/);
      expect(config.border).toMatch(/^rgba/);
      expect(config.prize).toBeTruthy();
      expect(config.emoji).toBeTruthy();
    }
  });

  it("tier 4 prize is 50% OFF TAB", () => {
    expect(TIER_CONFIG[4].prize).toBe("50% OFF TAB");
  });

  it("tier 3 prize is 20% OFF TAB", () => {
    expect(TIER_CONFIG[3].prize).toBe("20% OFF TAB");
  });

  it("tier 2 prize is FREE YCI SHELL", () => {
    expect(TIER_CONFIG[2].prize).toBe("FREE YCI SHELL");
  });

  it("tier 1 prize is $3 YCI SHELL", () => {
    expect(TIER_CONFIG[1].prize).toBe("$3 YCI SHELL");
  });
});

describe("Game constants", () => {
  it("MAX_PICKS is 5", () => {
    expect(MAX_PICKS).toBe(5);
  });

  it("TIERS_ORDER is [4, 3, 2, 1] (descending by rarity)", () => {
    expect([...TIERS_ORDER]).toEqual([4, 3, 2, 1]);
  });
});
