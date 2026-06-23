import { test, expect, Page } from "@playwright/test";

/**
 * Verifies that mascara (target) tiles, once revealed, stay visible for the
 * rest of the set — through the win transition (mancheWin overlay) and
 * through the loss/setResult transition — and only disappear when the next
 * set actually starts (tiles reset to hidden).
 */

const CONFIG_KEY = "sephora-game-config-v3";

// Selector for the mascara image rendered inside a revealed target tile.
const MASCARA_IMG = 'img[alt^="Sephora Collection — Big By Definition"]';

async function seedConfig(
  page: Page,
  overrides: Record<string, unknown>,
): Promise<void> {
  const base = {
    title: "MEMORY",
    titleAccent: "GAME",
    instruction: "TEST",
    targetProductName: "IT'S A STRETCH",
    targetsRequired: 2,
    targetsHidden: 4,
    attemptsAllowed: 4,
    durationSeconds: 999,
    gridCols: 2,
    gridRows: 2,
  };
  const cfg = { ...base, ...overrides };
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
      window.localStorage.removeItem("sephora-game-sessions");
    },
    [CONFIG_KEY, JSON.stringify(cfg)],
  );
}

function tile(page: Page, index: number) {
  return page.locator(`button[aria-label="Token ${index + 1}"]`);
}

async function isMascara(page: Page, index: number): Promise<boolean> {
  return (await tile(page, index).locator(MASCARA_IMG).count()) > 0;
}

async function startPlay(page: Page): Promise<void> {
  await page.goto("/");
  // Wait until the app has hydrated and the Commencer button is interactive.
  const commencer = page.getByRole("button", { name: /commencer/i });
  await expect(commencer).toBeVisible();
  await expect(commencer).toBeEnabled();
  // Click and wait until tiles become interactive (phase === "setPlaying").
  await commencer.click();
  await expect(tile(page, 0)).toBeEnabled({ timeout: 5000 });
}

test.describe("mascara tile lock", () => {
  test("target tiles remain visible during the WIN (mancheWin) transition", async ({
    page,
  }) => {
    // 4 cells, all mascara → first two clicks always win.
    await seedConfig(page, {
      targetsRequired: 2,
      targetsHidden: 4,
      attemptsAllowed: 4,
      gridCols: 2,
      gridRows: 2,
      durationSeconds: 999,
    });

    await startPlay(page);

    await tile(page, 0).click();
    await tile(page, 1).click();

    // Both mascaras visible immediately after their reveal animation.
    await expect(tile(page, 0).locator(MASCARA_IMG)).toBeVisible();
    await expect(tile(page, 1).locator(MASCARA_IMG)).toBeVisible();

    // Past the 2800 ms win hold → finishSet runs → mancheWin overlay opens.
    // Mascaras must STILL be in the DOM (locked for the rest of the set).
    await page.waitForTimeout(3200);
    expect(await isMascara(page, 0)).toBe(true);
    expect(await isMascara(page, 1)).toBe(true);

    // mancheWin only advances on user action — hold longer and re-check.
    await page.waitForTimeout(2500);
    expect(await isMascara(page, 0)).toBe(true);
    expect(await isMascara(page, 1)).toBe(true);
  });

  test("target tile remains visible during the LOSS (setResult) transition, then resets on next set", async ({
    page,
  }) => {
    // Every cell is a mascara, but only 1 attempt is allowed and 2 are
    // required → first click reveals a mascara AND ends the set as a loss.
    // This deterministically locks tile 0 with a mascara and forces the
    // loss-with-target branch (2800 ms hold).
    await seedConfig(page, {
      targetsRequired: 2,
      targetsHidden: 4,
      attemptsAllowed: 1,
      gridCols: 2,
      gridRows: 2,
      durationSeconds: 999,
    });

    await startPlay(page);

    await tile(page, 0).click();
    // The reveal completes within ~200 ms; the mascara should be visible.
    await expect(tile(page, 0).locator(MASCARA_IMG)).toBeVisible();

    // During the 2800 ms post-reveal hold, before finishSet fires.
    await page.waitForTimeout(1500);
    expect(await isMascara(page, 0)).toBe(true);

    // After finishSet → phase = setResult; 1600 ms until the next set starts.
    // Sample inside the setResult window — mascara must still be visible.
    await page.waitForTimeout(2000); // ~3.5 s total: well into setResult phase
    expect(await isMascara(page, 0)).toBe(true);

    // Once startSet runs the next manche, all tiles reset to "hidden" and
    // the lock is cleared. Wait long enough for set 2 to begin and verify
    // tile 0 no longer shows the previous set's mascara.
    await expect
      .poll(async () => isMascara(page, 0), { timeout: 6000, intervals: [200] })
      .toBe(false);
  });
});
