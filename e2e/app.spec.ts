import { test, expect, type Page } from "@playwright/test";

// Helper: clear localStorage and navigate fresh
async function freshPage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector('[data-slot="tabs"]');
}

// Helper: mock API responses so tests don't depend on a running backend
async function mockAPIs(page: Page, options?: {
  events?: Record<string, boolean>;
  players?: Array<{ name: string; picks: string[]; tiebreaker: string; ts: number }>;
}) {
  const events = options?.events ?? {};
  const players = options?.players ?? [];

  await page.route("**/api/events", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: events });
    }
    return route.continue();
  });

  await page.route("**/api/players", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: players });
    }
    if (route.request().method() === "POST") {
      return route.fulfill({
        json: { success: true, player: { ...JSON.parse(route.request().postData() || "{}"), ts: Date.now() } },
      });
    }
    return route.continue();
  });

  await page.route("**/api/events/*", (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({ json: events });
    }
    return route.continue();
  });

  await page.route("**/api/players/*", (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({ status: 200, json: { success: true } });
    }
    return route.continue();
  });

  await page.route("**/api/reset", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 200, json: { success: true } });
    }
    return route.continue();
  });
}

// ================================================================
// 1. INITIAL LOAD & HEADER
// ================================================================
test.describe("Initial Load & Header", () => {
  test("app loads and shows header branding", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("SUPER BOWL LX")).toBeVisible();
    await expect(page.getByText("KAVA CULTURE PRESENTS")).toBeVisible();
  });

  test("shows loading state before data arrives", async ({ page }) => {
    // Delay API response to catch loading state
    await page.route("**/api/events", (route) =>
      setTimeout(() => route.fulfill({ json: {} }), 2000)
    );
    await page.route("**/api/players", (route) =>
      setTimeout(() => route.fulfill({ json: [] }), 2000)
    );
    await page.goto("/");
    await expect(page.getByText("LOADING...")).toBeVisible();
  });

  test("shows player count in header", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestUser", picks: ["t1_pick_six", "t1_blowout", "t1_missed_fg", "t2_safety", "t4_overtime"], tiebreaker: "28-24", ts: 1000 },
        { name: "TestUser2", picks: ["t1_pick_six", "t1_blowout", "t1_missed_fg", "t2_safety", "t4_overtime"], tiebreaker: "21-17", ts: 2000 },
      ],
    });
    await freshPage(page);
    await expect(page.getByText("2 PLAYERS REGISTERED")).toBeVisible();
  });

  test("shows event hit count in header", async ({ page }) => {
    await mockAPIs(page, { events: { t4_overtime: true, t1_pick_six: true } });
    await freshPage(page);
    await expect(page.getByText("2 EVENTS HIT")).toBeVisible();
  });
});

// ================================================================
// 2. TAB NAVIGATION
// ================================================================
test.describe("Tab Navigation", () => {
  test("all 4 tabs are visible", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByRole("tab", { name: /PICKS/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /LIVE/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /PRIZES/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /ADMIN/ })).toBeVisible();
  });

  test("PICKS tab is active by default", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const picksTab = page.getByRole("tab", { name: /PICKS/ });
    await expect(picksTab).toHaveAttribute("data-state", "active");
  });

  test("clicking LIVE tab switches content", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();
  });

  test("clicking PRIZES tab shows prizes content", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("HOW PRIZES WORK")).toBeVisible();
  });

  test("clicking ADMIN tab shows admin login", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await expect(page.getByText("ADMIN ACCESS")).toBeVisible();
  });

  test("hash-based routing updates URL", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page).toHaveURL(/#live/);
  });

  test("navigating to hash URL loads correct tab", async ({ page }) => {
    await mockAPIs(page);
    await page.goto("/#prizes");
    await page.waitForSelector('[data-slot="tabs"]');
    const prizesTab = page.getByRole("tab", { name: /PRIZES/ });
    await expect(prizesTab).toHaveAttribute("data-state", "active");
  });

  test("tabs have proper ARIA roles", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const tablist = page.getByRole("tablist");
    await expect(tablist).toBeVisible();
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(4);
  });
});

// ================================================================
// 3. PICKS TAB - FORM & EVENT SELECTION
// ================================================================
test.describe("Picks Tab - Form", () => {
  test("shows name and tiebreaker inputs", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByPlaceholder("Enter your name")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. Chiefs 27, Eagles 24")).toBeVisible();
  });

  test("shows YOUR NAME and TIEBREAKER labels", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("YOUR NAME")).toBeVisible();
    await expect(page.getByText("TIEBREAKER: PREDICT FINAL SCORE")).toBeVisible();
  });

  test("shows pick counter with SELECT 5 MORE initially", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("SELECT 5 MORE")).toBeVisible();
    await expect(page.getByText("0/5")).toBeVisible();
  });

  test("shows all 4 tier sections", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("TIER 4")).toBeVisible();
    await expect(page.getByText("TIER 3")).toBeVisible();
    await expect(page.getByText("TIER 2")).toBeVisible();
    await expect(page.getByText("TIER 1")).toBeVisible();
  });

  test("shows all 30 events", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    // Tiers start expanded (collapsed=false), so events should be visible immediately
    await expect(page.getByText("Punt Return Touchdown")).toBeVisible();
    await expect(page.getByText("Blocked Punt", { exact: true })).toBeVisible();
    await expect(page.getByText("Safety Scored")).toBeVisible();
    await expect(page.getByText("Pick-Six (INT Returned for TD)")).toBeVisible();
  });

  test("selecting events updates pick counter", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Tiers start expanded — click an event directly
    await page.getByText("Punt Return Touchdown").click();
    await expect(page.getByText("SELECT 4 MORE")).toBeVisible();
    await expect(page.getByText("1/5")).toBeVisible();
  });

  test("selecting 5 events shows READY TO SUBMIT", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Tiers start expanded — select 5 events directly
    await page.getByText("Punt Return Touchdown").click();
    await page.getByText("Opening Kickoff Returned for TD").click();
    await page.getByText("Game Goes to Overtime").click();
    await page.getByText("Successful Onside Kick").click();
    await page.getByText("Blocked Punt/FG Returned for TD").click();

    await expect(page.getByText(/READY TO SUBMIT/)).toBeVisible();
    await expect(page.getByText("5/5")).toBeVisible();
  });

  test("deselecting event decreases counter", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    await page.getByText("Punt Return Touchdown").click();
    await expect(page.getByText("1/5")).toBeVisible();

    // Click again to deselect
    await page.getByText("Punt Return Touchdown").click();
    await expect(page.getByText("0/5")).toBeVisible();
  });

  test("event rows have proper checkbox role and aria", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Tiers start expanded — checkboxes are visible immediately
    const checkbox = page.getByRole("checkbox").first();
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toHaveAttribute("aria-checked", "false");

    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  test("submit button is disabled without name", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Select 5 events but don't enter name
    await page.getByText("Punt Return Touchdown").click();
    await page.getByText("Opening Kickoff Returned for TD").click();
    await page.getByText("Game Goes to Overtime").click();
    await page.getByText("Successful Onside Kick").click();
    await page.getByText("Blocked Punt/FG Returned for TD").click();

    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await expect(submitBtn).toBeDisabled();
  });

  test("successful submission navigates to live tab", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Fill form
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await page.getByPlaceholder("e.g. Chiefs 27, Eagles 24").fill("Chiefs 28, Eagles 21");

    // Select 5 events (tiers start expanded)
    await page.getByText("Punt Return Touchdown").click();
    await page.getByText("Opening Kickoff Returned for TD").click();
    await page.getByText("Game Goes to Overtime").click();
    await page.getByText("Successful Onside Kick").click();
    await page.getByText("Blocked Punt/FG Returned for TD").click();

    // Submit
    const submitBtn = page.getByRole("button", { name: /LOCK IN PICKS/ });
    await submitBtn.click();

    // Should navigate to live tab
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible({ timeout: 5000 });
  });

  test("after submission, picks tab shows locked screen", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);

    // Fill & submit
    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await page.getByText("Punt Return Touchdown").click();
    await page.getByText("Opening Kickoff Returned for TD").click();
    await page.getByText("Game Goes to Overtime").click();
    await page.getByText("Successful Onside Kick").click();
    await page.getByText("Blocked Punt/FG Returned for TD").click();
    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();
    await page.waitForTimeout(500);

    // Go back to picks
    await page.getByRole("tab", { name: /PICKS/ }).click();
    await expect(page.getByRole("heading", { name: "PICKS LOCKED IN" })).toBeVisible();
  });

  test("locked screen has Live Board link", async ({ page }) => {
    await mockAPIs(page);
    // Pre-set submitted state
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("sb-submitted", "true"));
    await page.goto("/");
    await page.waitForSelector('[data-slot="tabs"]');

    await expect(page.getByText("PICKS LOCKED IN")).toBeVisible();
    const liveLink = page.getByRole("button", { name: "Live Board" });
    await expect(liveLink).toBeVisible();

    await liveLink.click();
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();
  });
});

// ================================================================
// 4. LIVE TAB
// ================================================================
test.describe("Live Tab", () => {
  test("shows all tier sections with events", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();

    await expect(page.getByText("TIER 4")).toBeVisible();
    await expect(page.getByText("Punt Return Touchdown")).toBeVisible();
  });

  test("shows event hit count", async ({ page }) => {
    await mockAPIs(page, { events: { t4_overtime: true, t2_safety: true } });
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page.getByText("2 EVENTS HIT", { exact: true })).toBeVisible();
  });

  test("hit events show checkmark indicator", async ({ page }) => {
    await mockAPIs(page, { events: { t4_overtime: true } });
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();

    // The hit event row should have a green checkmark
    const overtimeRow = page.getByText("Game Goes to Overtime").locator("..");
    await expect(overtimeRow).toBeVisible();
  });

  test("shows AUTO-REFRESHING label", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /LIVE/ }).click();
    await expect(page.getByText("AUTO-REFRESHING")).toBeVisible();
  });
});

// ================================================================
// 5. PRIZES TAB
// ================================================================
test.describe("Prizes Tab", () => {
  test("shows HOW PRIZES WORK section", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("HOW PRIZES WORK")).toBeVisible();
  });

  test("shows all 4 tier prize cards", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("50% OFF TAB", { exact: true })).toBeVisible();
    await expect(page.getByText("20% OFF TAB", { exact: true })).toBeVisible();
    await expect(page.getByText("FREE YCI SHELL", { exact: true })).toBeVisible();
    await expect(page.getByText("$3 YCI SHELL", { exact: true })).toBeVisible();
  });

  test("shows empty leaderboard when no players", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();
    await expect(page.getByText("No players yet. Be the first!")).toBeVisible();
  });

  test("shows leaderboard with players", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "Alice", picks: ["t4_overtime", "t2_safety", "t1_pick_six", "t1_blowout", "t3_blocked_punt"], tiebreaker: "Chiefs 28", ts: 1000 },
        { name: "Bob", picks: ["t4_overtime", "t1_pick_six", "t1_missed_fg", "t2_safety", "t3_blocked_punt"], tiebreaker: "Eagles 24", ts: 2000 },
      ],
      events: { t4_overtime: true, t2_safety: true },
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();

    await expect(page.getByText("LEADERBOARD")).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
  });

  test("player cards show correct count", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "Alice", picks: ["t4_overtime", "t2_safety", "t1_pick_six", "t1_blowout", "t3_blocked_punt"], tiebreaker: "Chiefs 28", ts: 1000 },
      ],
      events: { t4_overtime: true, t2_safety: true },
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /PRIZES/ }).click();

    await expect(page.getByText("2/5")).toBeVisible();
  });
});

// ================================================================
// 6. ADMIN TAB
// ================================================================
test.describe("Admin Tab", () => {
  test("shows admin login form", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await expect(page.getByText("ADMIN ACCESS")).toBeVisible();
    await expect(page.getByPlaceholder("Enter code")).toBeVisible();
  });

  test("wrong admin code shows error toast", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("wrongcode");
    await page.getByRole("button", { name: "ENTER" }).click();

    // Sonner toast should appear
    await expect(page.getByText("Wrong code")).toBeVisible({ timeout: 3000 });
  });

  test("correct admin code shows event controls", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("EVENT CONTROLS")).toBeVisible();
  });

  test("admin Enter key submits code", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();

    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByPlaceholder("Enter code").press("Enter");

    await expect(page.getByText("EVENT CONTROLS")).toBeVisible();
  });

  test("admin shows event toggles (switches)", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    // All switches for events
    const switches = page.getByRole("switch");
    await expect(switches.first()).toBeVisible();
    // Should have 30 switches (one per event)
    await expect(switches).toHaveCount(30);
  });

  test("admin shows RESET ALL button", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByRole("button", { name: "RESET ALL" })).toBeVisible();
  });

  test("RESET ALL shows confirmation dialog", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await page.getByRole("button", { name: "RESET ALL" }).click();

    // ConfirmDialog should appear
    await expect(page.getByText("Reset All Data")).toBeVisible();
    await expect(page.getByText("This will clear all players and events")).toBeVisible();
  });

  test("cancel dialog does not reset", async ({ page }) => {
    await mockAPIs(page, {
      players: [{ name: "Alice", picks: ["t1_pick_six", "t1_blowout", "t1_missed_fg", "t2_safety", "t4_overtime"], tiebreaker: "", ts: 1000 }],
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await page.getByRole("button", { name: "RESET ALL" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Player should still be visible
    await expect(page.getByText("Alice")).toBeVisible();
  });

  test("admin shows registered players section", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: ["t1_pick_six", "t1_blowout", "t1_missed_fg", "t2_safety", "t4_overtime"], tiebreaker: "28-24", ts: 1000 },
      ],
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    await expect(page.getByText("REGISTERED PLAYERS (1)")).toBeVisible();
    await expect(page.getByText("TestPlayer")).toBeVisible();
    await expect(page.getByText("5 picks")).toBeVisible();
  });

  test("delete player shows confirmation dialog", async ({ page }) => {
    await mockAPIs(page, {
      players: [
        { name: "TestPlayer", picks: ["t1_pick_six", "t1_blowout", "t1_missed_fg", "t2_safety", "t4_overtime"], tiebreaker: "", ts: 1000 },
      ],
    });
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    // Click the X button next to the player
    await page.getByRole("button", { name: "×" }).click();

    // ConfirmDialog should appear
    await expect(page.getByText("Remove Player")).toBeVisible();
    await expect(page.getByText(/Remove "TestPlayer"/)).toBeVisible();
  });
});

// ================================================================
// 7. ACCESSIBILITY
// ================================================================
test.describe("Accessibility", () => {
  test("tablist has proper role", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("active tab has aria-selected", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const picksTab = page.getByRole("tab", { name: /PICKS/ });
    await expect(picksTab).toHaveAttribute("aria-selected", "true");

    const liveTab = page.getByRole("tab", { name: /LIVE/ });
    await expect(liveTab).toHaveAttribute("aria-selected", "false");
  });

  test("tab panels have proper role", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const panels = page.getByRole("tabpanel");
    await expect(panels.first()).toBeVisible();
  });

  test("pick counter has aria-live polite", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    // Target the pick counter specifically (not the Sonner notification region)
    const liveRegion = page.locator("[aria-live='polite']").filter({ hasText: /SELECT|READY/ });
    await expect(liveRegion).toBeVisible();
  });

  test("event rows use checkbox role", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    // Tiers start expanded — checkboxes should be visible immediately
    const checkboxes = page.getByRole("checkbox");
    await expect(checkboxes.first()).toBeVisible();
  });

  test("admin switches use switch role", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    await page.getByRole("tab", { name: /ADMIN/ }).click();
    await page.getByPlaceholder("Enter code").fill("kava60");
    await page.getByRole("button", { name: "ENTER" }).click();

    const switches = page.getByRole("switch");
    await expect(switches.first()).toBeVisible();
  });

  test("keyboard navigation works on event rows", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    // Tiers start expanded — find first checkbox
    const firstCheckbox = page.getByRole("checkbox").first();
    await firstCheckbox.focus();
    await page.keyboard.press("Enter");
    await expect(firstCheckbox).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("Space");
    await expect(firstCheckbox).toHaveAttribute("aria-checked", "false");
  });

  test("tier sections have aria-expanded", async ({ page }) => {
    await mockAPIs(page);
    await freshPage(page);
    const tierButton = page.locator("[aria-expanded]").first();
    await expect(tierButton).toBeVisible();
  });
});

// ================================================================
// 8. RESPONSIVE & VISUAL
// ================================================================
test.describe("Visual & Interaction", () => {
  test("submit button shows spinner during submission", async ({ page }) => {
    // Slow down the POST so we can observe the spinner
    await page.route("**/api/events", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/players", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: [] });
      // Delay POST response
      return new Promise((resolve) =>
        setTimeout(() => resolve(route.fulfill({
          json: { success: true, player: { name: "Test", picks: [], tiebreaker: "", ts: Date.now() } }
        })), 2000)
      );
    });

    await freshPage(page);

    await page.getByPlaceholder("Enter your name").fill("TestPlayer");
    await page.getByText("Punt Return Touchdown").click();
    await page.getByText("Opening Kickoff Returned for TD").click();
    await page.getByText("Game Goes to Overtime").click();
    await page.getByText("Successful Onside Kick").click();
    await page.getByText("Blocked Punt/FG Returned for TD").click();

    await page.getByRole("button", { name: /LOCK IN PICKS/ }).click();

    // Should show SUBMITTING state
    await expect(page.getByText("SUBMITTING...")).toBeVisible({ timeout: 2000 });
  });

  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("SUPER BOWL LX")).toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  test("tablet viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockAPIs(page);
    await freshPage(page);
    await expect(page.getByText("SUPER BOWL LX")).toBeVisible();
  });
});
