import { chromium } from "@playwright/test";

const BASE = "http://localhost:5175";
const OUT = "/tmp/claude-1000/-home-lando555-gameday-bingo/a1b3e074-9bbb-4324-999f-0a9891360f5c/scratchpad/screenshots";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // Mock APIs with representative data
  await page.route("**/api/events", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { t4_overtime: true, t2_safety: true, t1_pick_six: true } });
    }
    return route.continue();
  });
  await page.route("**/api/players", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: [
          { name: "Alex Johnson", picks: ["t4_overtime", "t2_safety", "t1_pick_six", "t1_blowout", "t3_blocked_punt"], tiebreaker: "Chiefs 28, Eagles 24", ts: 1000 },
          { name: "Maria Gonzalez-Hernandez", picks: ["t4_overtime", "t1_pick_six", "t1_missed_fg", "t2_safety", "t3_blocked_punt"], tiebreaker: "Eagles 31, Chiefs 27", ts: 2000 },
          { name: "Bob", picks: ["t2_safety", "t1_blowout", "t1_missed_fg", "t2_blocked_fg", "t4_ejection"], tiebreaker: "", ts: 3000 },
        ],
      });
    }
    if (route.request().method() === "POST") {
      return route.fulfill({
        json: { success: true, player: { name: "Test", picks: [], tiebreaker: "", ts: Date.now() } },
      });
    }
    return route.continue();
  });
  await page.route("**/api/events/*", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/players/*", (route) => route.fulfill({ status: 200, json: { success: true } }));
  await page.route("**/api/reset", (route) => route.fulfill({ status: 200, json: { success: true } }));

  // Clear state
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.waitForSelector('[data-slot="tabs"]');

  // 1. Picks tab - empty form
  await page.screenshot({ path: `${OUT}/01-picks-empty.png`, fullPage: true });

  // 2. Picks tab - with name filled and some picks selected
  await page.getByPlaceholder("Enter your name").fill("TestPlayer");
  await page.getByPlaceholder("e.g. Chiefs 27, Eagles 24").fill("Chiefs 31, Eagles 28");
  await page.getByText("Punt Return Touchdown").click();
  await page.getByText("Opening Kickoff Returned for TD").click();
  await page.getByText("Game Goes to Overtime").click();
  await page.screenshot({ path: `${OUT}/02-picks-partial.png`, fullPage: true });

  // 3. Picks tab - 5 picks selected (ready to submit)
  await page.getByText("Successful Onside Kick").click();
  await page.getByText("Blocked Punt/FG Returned for TD").click();
  await page.screenshot({ path: `${OUT}/03-picks-ready.png`, fullPage: true });

  // 4. Picks tab - scroll to bottom (submit button area)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/04-picks-submit-area.png` });

  // 5. Locked screen (simulate submitted)
  await page.evaluate(() => localStorage.setItem("sb-submitted", "true"));
  await page.goto(BASE);
  await page.waitForSelector('[data-slot="tabs"]');
  await page.screenshot({ path: `${OUT}/05-locked-screen.png`, fullPage: true });

  // 6. Live tab
  await page.getByRole("tab", { name: /LIVE/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/06-live-tab.png`, fullPage: true });

  // 7. Prizes tab
  await page.getByRole("tab", { name: /PRIZES/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/07-prizes-tab.png`, fullPage: true });

  // 8. Prizes tab - scroll to leaderboard
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/08-prizes-leaderboard.png` });

  // 9. Admin tab - login
  await page.getByRole("tab", { name: /ADMIN/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/09-admin-login.png`, fullPage: true });

  // 10. Admin tab - wrong code toast
  await page.getByPlaceholder("Enter code").fill("wrong");
  await page.getByRole("button", { name: "ENTER" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/10-admin-wrong-code.png`, fullPage: true });

  // 11. Admin tab - authenticated
  await page.getByPlaceholder("Enter code").fill("kava60");
  await page.getByRole("button", { name: "ENTER" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/11-admin-authenticated.png`, fullPage: true });

  // 12. Admin tab - scroll to players
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/12-admin-players.png` });

  // 13. Admin tab - reset confirmation dialog
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "RESET ALL" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/13-admin-reset-dialog.png` });
  await page.getByRole("button", { name: "Cancel" }).click();

  // 14. Admin tab - delete player dialog
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "×" }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/14-admin-delete-dialog.png` });

  // 15-17. Desktop viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.waitForSelector('[data-slot="tabs"]');
  await page.screenshot({ path: `${OUT}/15-desktop-picks.png`, fullPage: true });

  await page.getByRole("tab", { name: /LIVE/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/16-desktop-live.png`, fullPage: true });

  await page.getByRole("tab", { name: /PRIZES/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/17-desktop-prizes.png`, fullPage: true });

  await browser.close();
  console.log("All 17 screenshots saved to", OUT);
}

main().catch(console.error);
