import { test, expect, type Page } from "@playwright/test";

// ================================================================
// HELPERS
// ================================================================

const STANDARD_PICKS = [
  "q1_opening_kick_td", "q1_first_score_fg",
  "q2_pick_six", "q2_50yd_fg",
  "q3_first_drive_td", "q3_no_points",
  "q4_2pt_attempted", "q4_overtime",
  "fg_gatorade_orange", "fg_margin_3",
];

async function mockAPIs(page: Page, options?: {
  events?: Record<string, boolean>;
  players?: Array<{ name: string; picks: string[]; tiebreaker: string; ts: number }>;
  gameLocked?: boolean;
  postPlayerHandler?: (route: import("@playwright/test").Route) => Promise<void> | void;
  lockHandler?: (route: import("@playwright/test").Route) => Promise<void> | void;
}) {
  const events = options?.events ?? {};
  const players = options?.players ?? [];
  const locked = options?.gameLocked ?? false;

  await page.route("**/api/events", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: events });
    return route.continue();
  });

  await page.route("**/api/players", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: players });
    if (route.request().method() === "POST") {
      if (options?.postPlayerHandler) return options.postPlayerHandler(route);
      return route.fulfill({
        json: { success: true, player: { ...JSON.parse(route.request().postData() || "{}"), ts: Date.now() } },
      });
    }
    return route.continue();
  });

  await page.route("**/api/events/*", (route) => {
    if (route.request().method() === "PUT") return route.fulfill({ json: events });
    return route.continue();
  });

  await page.route("**/api/players/*", (route) => {
    if (route.request().method() === "DELETE") return route.fulfill({ status: 200, json: { success: true } });
    return route.continue();
  });

  await page.route("**/api/reset", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 200, json: { success: true } });
    return route.continue();
  });

  await page.route("**/api/game-state", (route) =>
    route.fulfill({ json: { locked } })
  );

  await page.route("**/api/lock", (route) => {
    if (options?.lockHandler) return options.lockHandler(route);
    if (route.request().method() === "POST") return route.fulfill({ json: { locked: !locked } });
    return route.continue();
  });

  await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));
}

async function freshPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector('[data-slot="tabs"]');
}

async function freshPicksPage(page: Page) {
  await freshPage(page);
  await page.getByRole("tab", { name: /PICKS/ }).click();
}

async function selectTenEvents(page: Page) {
  await page.getByText("Opening Kickoff Returned for TD").click();
  await page.getByText("First Score Is a Field Goal").click();
  await page.getByText("Pick-Six Thrown in Q2").click();
  await page.getByText("50+ Yard Field Goal Made in Q2").click();
  await page.getByText("First Drive of Second Half Scores TD").click();
  await page.getByText("No Points Scored in Q3").click();
  await page.getByText("Two-Point Conversion Attempted").click();
  await page.getByText("Game Goes to Overtime").click();
  await page.getByText("Gatorade Bath Color Is ORANGE").click();
  await page.getByText("Final Margin Exactly 3 Points").click();
}

async function authenticateAdmin(page: Page) {
  await page.getByRole("tab", { name: /ADMIN/ }).click();
  await page.getByPlaceholder("Enter code").fill("kava60");
  await page.getByRole("button", { name: "ENTER" }).click();
  await expect(page.getByText("EVENT CONTROLS")).toBeVisible();
}

// ================================================================
// 1. SAFE LOCALSTORAGE WRAPPER
// ================================================================
test.describe("Safe localStorage Wrapper", () => {
  test("app loads when localStorage.getItem throws", async ({ page }) => {
    await mockAPIs(page);
    // First load normally to set up routes
    await page.goto("/");
    await page.waitForSelector('[data-slot="tabs"]');

    // Override localStorage.getItem to throw
    await page.evaluate(() => {
      Object.defineProperty(window, "localStorage", {
        value: {
          ...window.localStorage,
          getItem: () => { throw new Error("SecurityError: access denied"); },
          setItem: window.localStorage.setItem.bind(window.localStorage),
          removeItem: window.localStorage.removeItem.bind(window.localStorage),
          clear: window.localStorage.clear.bind(window.localStorage),
        },
        writable: true,
        configurable: true,
      });
    });

    // Reload — safeGetItem should catch the error and return null
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await expect(page.getByRole("heading", { name: "SUPER BOWL LX" })).toBeVisible();
  });

  test("submit succeeds when localStorage.setItem throws", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Override setItem to throw (after page loads so routes are set up)
    await page.evaluate(() => {
      const originalGet = localStorage.getItem.bind(localStorage);
      const originalRemove = localStorage.removeItem.bind(localStorage);
      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: originalGet,
          setItem: () => { throw new Error("QuotaExceededError"); },
          removeItem: originalRemove,
          clear: localStorage.clear.bind(localStorage),
          length: 0,
          key: () => null,
        },
        writable: true,
        configurable: true,
      });
    });

    // Fill form and submit
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Should still navigate to live tab despite localStorage write failure
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible({ timeout: 5000 });
  });

  test("app loads when localStorage.removeItem throws", async ({ page }) => {
    await mockAPIs(page);

    // Set up submitted state, but with missing player (triggers self-healing removeItem)
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "alice");
    });

    // Override removeItem to throw
    await page.evaluate(() => {
      const originalGet = localStorage.getItem.bind(localStorage);
      const originalSet = localStorage.setItem.bind(localStorage);
      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: originalGet,
          setItem: originalSet,
          removeItem: () => { throw new Error("SecurityError"); },
          clear: localStorage.clear.bind(localStorage),
          length: 0,
          key: () => null,
        },
        writable: true,
        configurable: true,
      });
    });

    // Reload — self-healing tries safeRemoveItem, should not crash
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await expect(page.getByRole("heading", { name: "SUPER BOWL LX" })).toBeVisible();
  });
});

// ================================================================
// 2. ADMIN SUBMISSION LOCK TOGGLE
// ================================================================
test.describe("Admin Submission Lock Toggle", () => {
  test("LOCK button visible in authenticated admin panel", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await authenticateAdmin(page);

    await expect(page.getByRole("button", { name: "LOCK" })).toBeVisible();
    await expect(page.getByText("Picks are open")).toBeVisible();
  });

  test("clicking LOCK toggles to UNLOCK with locked status text", async ({ page }) => {
    let currentLocked = false;
    await mockAPIs(page, {
      lockHandler: async (route) => {
        if (route.request().method() === "POST") {
          currentLocked = !currentLocked;
          return route.fulfill({ json: { locked: currentLocked } });
        }
        return route.continue();
      },
    });
    await freshPage(page);
    await authenticateAdmin(page);

    // Click LOCK
    await page.getByRole("button", { name: "LOCK" }).click();
    await expect(page.getByRole("button", { name: "UNLOCK" })).toBeVisible();
    await expect(page.getByText("Picks are currently locked")).toBeVisible();

    // Click UNLOCK
    await page.getByRole("button", { name: "UNLOCK" }).click();
    await expect(page.getByRole("button", { name: "LOCK" })).toBeVisible();
    await expect(page.getByText("Picks are open")).toBeVisible();
  });

  test("ClosedScreen shown on PICKS tab when game is locked", async ({ page }) => {
    await mockAPIs(page, { gameLocked: true });
    await freshPage(page);
    await page.getByRole("tab", { name: /PICKS/ }).click();

    await expect(page.getByRole("heading", { name: "SUBMISSIONS CLOSED" })).toBeVisible();
    await expect(page.getByText("picks are no longer being accepted")).toBeVisible();
  });

  test("LockedScreen takes priority over ClosedScreen for submitted users", async ({ page }) => {
    await mockAPIs(page, {
      gameLocked: true,
      players: [{ name: "TestPlayer", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 }],
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "testplayer");
    });
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await page.getByRole("tab", { name: /PICKS/ }).click();

    await expect(page.getByRole("heading", { name: "PICKS LOCKED IN" })).toBeVisible();
    await expect(page.getByText("SUBMISSIONS CLOSED")).not.toBeVisible();
  });

  test("admin unlock makes form re-appear on PICKS tab", async ({ page }) => {
    let currentLocked = true;

    // Custom routing for dynamic lock state
    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: {} });
      return route.continue();
    });
    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: [] });
      return route.continue();
    });
    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: currentLocked } })
    );
    await page.route("**/api/lock", (route) => {
      if (route.request().method() === "POST") {
        currentLocked = !currentLocked;
        return route.fulfill({ json: { locked: currentLocked } });
      }
      return route.continue();
    });
    await page.route("**/api/events/*", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/players/*", (route) => route.fulfill({ status: 200, json: { success: true } }));
    await page.route("**/api/reset", (route) => route.fulfill({ status: 200, json: { success: true } }));
    await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));

    await freshPage(page);

    // Verify locked
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await expect(page.getByText("SUBMISSIONS CLOSED")).toBeVisible();

    // Admin unlocks
    await authenticateAdmin(page);
    await page.getByRole("button", { name: "UNLOCK" }).click();

    // Go back to picks — form should appear
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await expect(page.getByText("YOUR NAME")).toBeVisible();
    await expect(page.getByText("SUBMISSIONS CLOSED")).not.toBeVisible();
  });

  test("API returns 403 when submitting while locked", async ({ page }) => {
    await mockAPIs(page, {
      postPlayerHandler: async (route) => {
        return route.fulfill({ status: 403, json: { error: "Submissions are closed" } });
      },
    });
    await freshPicksPage(page);

    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    await expect(page.getByText("Submissions are closed")).toBeVisible({ timeout: 3000 });
  });

  test("toast shows success after locking", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await authenticateAdmin(page);

    await page.getByRole("button", { name: "LOCK" }).click();
    await expect(page.getByText("Submissions locked!")).toBeVisible({ timeout: 3000 });
  });

  test("reset clears lock state", async ({ page }) => {
    let currentLocked = true;

    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: {} });
      return route.continue();
    });
    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: [] });
      return route.continue();
    });
    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: currentLocked } })
    );
    await page.route("**/api/lock", (route) => {
      if (route.request().method() === "POST") {
        currentLocked = !currentLocked;
        return route.fulfill({ json: { locked: currentLocked } });
      }
      return route.continue();
    });
    await page.route("**/api/reset", (route) => {
      if (route.request().method() === "POST") {
        currentLocked = false;
        return route.fulfill({ status: 200, json: { success: true } });
      }
      return route.continue();
    });
    await page.route("**/api/events/*", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/players/*", (route) => route.fulfill({ status: 200, json: { success: true } }));
    await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));

    await freshPage(page);
    await authenticateAdmin(page);

    // Verify starts locked
    await expect(page.getByRole("button", { name: "UNLOCK" })).toBeVisible();

    // Reset
    await page.getByRole("button", { name: "RESET ALL" }).click();
    await page.getByRole("button", { name: /Reset All/i }).click();

    // After reset, should show LOCK (not UNLOCK)
    await expect(page.getByRole("button", { name: "LOCK" })).toBeVisible({ timeout: 3000 });
  });
});

// ================================================================
// 3. TIEBREAKER LABEL + LENGTH VALIDATION
// ================================================================
test.describe("Tiebreaker Label and Length Validation", () => {
  test("tiebreaker label shows BONUS text", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);
    await expect(page.getByText("BONUS: PREDICT FINAL SCORE")).toBeVisible();
  });

  test("tiebreaker subtitle shows earliest-submission explanation", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);
    await expect(page.getByText("for fun — ties broken by earliest submission")).toBeVisible();
  });

  test("tiebreaker input has maxLength attribute of 100", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);
    const input = page.getByPlaceholder("e.g. Seahawks 27, Patriots 24");
    await expect(input).toHaveAttribute("maxlength", "100");
  });

  test("tiebreaker accepts exactly 100 characters", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);
    const input = page.getByPlaceholder("e.g. Seahawks 27, Patriots 24");
    const chars100 = "A".repeat(100);
    await input.fill(chars100);
    await expect(input).toHaveValue(chars100);
  });

  test("name character counter appears near boundary and shows red at max", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);
    const input = page.getByPlaceholder("Enter your name");

    // Counter appears at >30 chars (MAX_NAME_LENGTH - 10 = 30)
    await input.fill("A".repeat(31));
    await expect(page.getByText("31/40")).toBeVisible();

    // At max, counter shows destructive color
    await input.fill("A".repeat(40));
    await expect(page.getByText("40/40")).toBeVisible();
    const counter = page.getByText("40/40");
    await expect(counter).toHaveClass(/text-destructive/);
  });
});

// ================================================================
// 4. USER'S PICKS ON LIVE BOARD
// ================================================================
test.describe("User Picks on Live Board", () => {
  test("MY PICK labels appear on submitted user's events", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: STANDARD_PICKS, tiebreaker: "28-24", ts: 1000 },
      ],
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "testplayer");
    });
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await page.getByRole("tab", { name: /LIVE/ }).click();

    // Should have exactly 10 MY PICK labels
    const myPickLabels = page.locator("text=MY PICK");
    await expect(myPickLabels.first()).toBeVisible();
    await expect(myPickLabels).toHaveCount(10);
  });

  test("YOUR PICKS summary shows correct hit count", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 },
      ],
      events: { q4_overtime: true, q2_pick_six: true },
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "testplayer");
    });
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await page.getByRole("tab", { name: /LIVE/ }).click();

    await expect(page.getByText("YOUR PICKS: 2/10 HIT")).toBeVisible();
  });

  test("MY PICK label NOT shown for non-submitted users", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "SomeoneElse", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 },
      ],
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();

    await expect(page.locator("text=MY PICK")).toHaveCount(0);
    await expect(page.getByText(/YOUR PICKS/)).not.toBeVisible();
  });

  test("YOUR PICKS summary not shown when no one has submitted", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();

    await expect(page.getByText(/YOUR PICKS/)).not.toBeVisible();
  });

  test("MY PICK label styled green when event is hit", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 },
      ],
      events: { q4_overtime: true },
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "testplayer");
    });
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await page.getByRole("tab", { name: /LIVE/ }).click();

    // Find the hit event row with MY PICK
    const hitRow = page.locator("div").filter({ hasText: /Game Goes to Overtime/ }).filter({ hasText: "MY PICK" }).first();
    await expect(hitRow).toBeVisible();

    // The hit indicator should have the hit aria-label
    const hitIndicator = hitRow.locator('[aria-label="Event hit"]');
    await expect(hitIndicator).toBeVisible();
  });

  test("picked events have left border accent styling", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 },
      ],
      events: { q4_overtime: true },
    });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "testplayer");
    });
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');
    await page.getByRole("tab", { name: /LIVE/ }).click();

    // Hit picked event — find the element with border-l class that contains this event
    const hitBorder = page.locator('div[class*="border-l"]').filter({ hasText: /Game Goes to Overtime/ });
    await expect(hitBorder).toBeVisible();
    await expect(hitBorder).toHaveClass(/border-l-accent-green/);

    // Non-hit picked event — should also have left border
    const nonHitBorder = page.locator('div[class*="border-l"]').filter({ hasText: /Opening Kickoff Returned for TD/ });
    await expect(nonHitBorder).toBeVisible();
    await expect(nonHitBorder).toHaveClass(/border-l-primary/);
  });
});
