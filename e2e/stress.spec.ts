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
  postPlayerHandler?: (route: import("@playwright/test").Route) => Promise<void> | void;
  eventsHandler?: (route: import("@playwright/test").Route) => Promise<void> | void;
  playersHandler?: (route: import("@playwright/test").Route) => Promise<void> | void;
}) {
  const events = options?.events ?? {};
  const players = options?.players ?? [];

  await page.route("**/api/events", (route) => {
    if (options?.eventsHandler && route.request().method() === "GET") return options.eventsHandler(route);
    if (route.request().method() === "GET") return route.fulfill({ json: events });
    return route.continue();
  });

  await page.route("**/api/players", (route) => {
    if (options?.playersHandler && route.request().method() === "GET") return options.playersHandler(route);
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
    route.fulfill({ json: { locked: false } })
  );

  await page.route("**/api/lock", (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({ json: { locked: false } });
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

// ================================================================
// 1. RAPID TAB SWITCHING
// ================================================================
test.describe("Rapid Tab Switching", () => {
  test("switching through all 5 tabs rapidly does not crash", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Rapidly switch through all tabs
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByRole("tab", { name: /RULES/ }).click();
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await page.getByRole("tab", { name: /PRIZES/ }).click();

    // App should not crash — header still visible
    await expect(page.getByRole("heading", { name: "SUPER BOWL LX" })).toBeVisible();
    // Active tab should be prizes (last clicked)
    const prizesTab = page.getByRole("tab", { name: /PRIZES/ });
    await expect(prizesTab).toHaveAttribute("data-state", "active");
  });
});

// ================================================================
// 2. DUPLICATE NAME SUBMISSION
// ================================================================
test.describe("Duplicate Name Submission", () => {
  test("409 duplicate name shows error toast and form stays usable", async ({ page }) => {
    await mockAPIs(page, {
      postPlayerHandler: async (route) => {
        return route.fulfill({
          status: 409,
          json: { error: "Name already taken" },
        });
      },
    });
    await freshPicksPage(page);

    await page.getByPlaceholder("Enter your name").fill("ExistingPlayer");
    await selectTenEvents(page);
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Error toast
    await expect(page.getByText("Name already taken")).toBeVisible({ timeout: 3000 });

    // Form should remain usable (not locked)
    await expect(page.getByRole("button", { name: /LOCK IN PICKS/ })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: /LOCK IN PICKS/ })).toBeEnabled();
    await expect(page.getByPlaceholder("Enter your name")).toHaveValue("ExistingPlayer");
    await expect(page.getByText("10/10")).toBeVisible();
  });
});

// ================================================================
// 3. SELF-HEALING E2E
// ================================================================
test.describe("Self-Healing localStorage Reset", () => {
  test("clears lock when player removed by admin", async ({ page }) => {
    await mockAPIs(page, {
      players: [], // Alice was removed — empty list
    });

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "alice");
    });
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');

    // Self-healing should have cleared the flags
    const submitted = await page.evaluate(() => localStorage.getItem("sb-submitted"));
    expect(submitted).toBeNull();

    // PICKS tab should show form, not LockedScreen
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await expect(page.getByText("YOUR NAME")).toBeVisible();
    await expect(page.getByText("PICKS LOCKED IN")).not.toBeVisible();
  });

  test("keeps lock when player still exists on server", async ({ page }) => {
    await mockAPIs(page, {
      players: [{ name: "Alice", picks: STANDARD_PICKS, tiebreaker: "", ts: 1000 }],
    });

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("sb-submitted", "true");
      localStorage.setItem("sb-submitted-name", "alice");
    });
    await page.reload();
    await page.waitForSelector('[data-slot="tabs"]');

    // Lock should be preserved
    const submitted = await page.evaluate(() => localStorage.getItem("sb-submitted"));
    expect(submitted).toBe("true");

    // PICKS tab should show LockedScreen
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await expect(page.getByRole("heading", { name: "PICKS LOCKED IN" })).toBeVisible();
  });
});

// ================================================================
// 4. ERROR STATE RETRY
// ================================================================
test.describe("Error State Retry", () => {
  test("shows FAILED TO LOAD and Try Again button when APIs fail", async ({ page }) => {
    // Mock all initial APIs to fail
    await page.route("**/api/events", (route) =>
      route.fulfill({ status: 500, json: { error: "Server down" } })
    );
    await page.route("**/api/players", (route) =>
      route.fulfill({ status: 500, json: { error: "Server down" } })
    );
    await page.route("**/api/game-state", (route) =>
      route.fulfill({ status: 500, json: { error: "Server down" } })
    );
    await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");

    await expect(page.getByText("FAILED TO LOAD")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  });

  test("retry button recovers after transient failure", async ({ page }) => {
    // Use a boolean flag (not a counter) to avoid race conditions
    // between concurrent event/player fetches and double-navigation
    let shouldFail = true;

    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET") {
        if (shouldFail) return route.fulfill({ status: 500, json: { error: "down" } });
        return route.fulfill({ json: {} });
      }
      return route.continue();
    });
    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET") {
        if (shouldFail) return route.fulfill({ status: 500, json: { error: "down" } });
        return route.fulfill({ json: [] });
      }
      return route.continue();
    });
    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: false } })
    );
    await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");

    // First load fails
    await expect(page.getByText("FAILED TO LOAD")).toBeVisible({ timeout: 5000 });

    // Fix the mock before retrying
    shouldFail = false;

    // Click retry — second attempt succeeds
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect(page.getByRole("heading", { name: "SUPER BOWL LX" })).toBeVisible({ timeout: 5000 });
  });
});

// ================================================================
// 5. POLLING UPDATES
// ================================================================
test.describe("Polling Updates", () => {
  test("live board reflects server-side event changes via polling", async ({ page }) => {
    // Use a boolean flag toggled after initial assertions (not a counter,
    // since freshPage double-navigates and increments counters prematurely)
    let addHit = false;

    await page.route("**/api/events", (route) => {
      if (route.request().method() === "GET") {
        if (addHit) {
          return route.fulfill({ json: { q4_overtime: true } });
        }
        return route.fulfill({ json: {} });
      }
      return route.continue();
    });
    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: [] });
      return route.continue();
    });
    await page.route("**/api/game-state", (route) =>
      route.fulfill({ json: { locked: false } })
    );
    await page.route("**/api/verify**", (route) => route.fulfill({ json: {} }));

    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();

    // Initially 0 hits — the hit counter element doesn't render at all when 0
    await expect(page.getByText("1 EVENT HIT", { exact: true })).not.toBeVisible();

    // Enable the hit for the next poll cycle
    addHit = true;

    // Wait for polling to pick up the change (poll interval 8s + render buffer)
    await expect(page.getByText("1 EVENT HIT", { exact: true })).toBeVisible({ timeout: 15000 });
  });
});

// ================================================================
// 6. EMPTY NAME GUARD
// ================================================================
test.describe("Empty Name Guard", () => {
  test("submit button stays disabled after clearing name with 10 picks", async ({ page }) => {
    await mockAPIs(page);
    await freshPicksPage(page);

    // Fill name and select 10 picks
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await selectTenEvents(page);

    // Button should be enabled
    await expect(page.getByRole("button", { name: /LOCK IN PICKS/ })).toBeEnabled();

    // Clear the name
    await page.getByPlaceholder("Enter your name").fill("");

    // Button should become disabled
    await expect(page.getByRole("button", { name: /LOCK IN PICKS/ })).toBeDisabled();
  });
});
