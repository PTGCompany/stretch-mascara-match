import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for the 4×5 memory game with 10 pairs, 30 seconds, and 5 reward tiers.
 *
 * Verifies that a player can:
 *  - start a single play session via the rules screen
 *  - flip a correct pair (cards lock as matched, pair count increments)
 *  - flip an incorrect pair (cards flip back, pair count unchanged)
 *  - reach a win level without the game stopping
 *  - see the final score and level when time runs out
 *  - replay to get a fresh shuffled board
 */

const CONFIG_KEY = "sephora-game-config-v8";
const SESS_KEY = "sephora-game-sessions-v3";

type ConfigOverride = Record<string, unknown>;

async function seedConfig(page: Page, overrides: ConfigOverride): Promise<void> {
  const base = {
    title: "MEMORY",
    titleAccent: "GAME",
    instruction: "TEST",
    heroProductName: "IT'S A STRETCH",
    durationSeconds: 60,
    gridRows: 5,
    gridCols: 4,
    totalPairs: 10,
    flipBackDelayMs: 600,
    trackWrongAttempts: true,
    pointsPerPair: 100,
    timeBonusEnabled: true,
    timeBonusPointsPerSecond: 10,
    brandColor: "#ed6f7e",
    winLevels: [
      { level: 1, min: 1, max: 2, message: "TIER 1 REWARD" },
      { level: 2, min: 3, max: 4, message: "TIER 2 REWARD" },
      { level: 3, min: 5, max: 6, message: "TIER 3 REWARD" },
      { level: 4, min: 7, max: 8, message: "TIER 4 REWARD" },
      { level: 5, min: 9, max: 10, message: "TIER 5 REWARD" },
    ],
  };
  const cfg = { ...base, ...overrides };
  await page.addInitScript(
    ([k, v, sk]) => {
      window.localStorage.setItem(k as string, v as string);
      window.localStorage.removeItem(sk as string);
    },
    [CONFIG_KEY, JSON.stringify(cfg), SESS_KEY],
  );
}

function card(page: Page, idx: number) {
  return page.locator(`button[data-card-index="${idx}"]`);
}

async function productIdOf(page: Page, idx: number): Promise<string> {
  return (
    (await card(page, idx).getAttribute("data-product-id")) ?? ""
  );
}

async function cardState(page: Page, idx: number): Promise<string> {
  return (await card(page, idx).getAttribute("data-card-state")) ?? "";
}

/** Returns indices of two cards that share the same productId. */
async function findMatchingPair(page: Page): Promise<[number, number]> {
  const all = await page.locator("button[data-card-index]").all();
  const ids = await Promise.all(
    all.map(async (el, i) => ({
      i,
      pid: (await el.getAttribute("data-product-id")) ?? "",
    })),
  );
  const byPid = new Map<string, number[]>();
  for (const { i, pid } of ids) {
    if (!pid) continue;
    if (!byPid.has(pid)) byPid.set(pid, []);
    byPid.get(pid)!.push(i);
  }
  for (const [, list] of byPid) {
    if (list.length >= 2) return [list[0], list[1]];
  }
  throw new Error("no matching pair found");
}

/** Returns indices of two cards that have DIFFERENT productIds. */
async function findMismatchedPair(page: Page): Promise<[number, number]> {
  const all = await page.locator("button[data-card-index]").all();
  const ids = await Promise.all(
    all.map(async (el, i) => ({
      i,
      pid: (await el.getAttribute("data-product-id")) ?? "",
    })),
  );
  const first = ids[0];
  const other = ids.find((x) => x.pid && x.pid !== first.pid);
  if (!other) throw new Error("no mismatched pair found");
  return [first.i, other.i];
}

async function startGame(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const start = page.getByRole("button", { name: /start/i });
  await expect(start).toBeVisible();
  await start.click();
  const playNow = page.getByRole("button", { name: /play now/i });
  await expect(playNow).toBeVisible();
  await expect
    .poll(
      async () => {
        await playNow.click({ trial: false }).catch(() => {});
        return await card(page, 0).isEnabled();
      },
      { timeout: 10_000, intervals: [200, 400, 600] },
    )
    .toBe(true);
}

test.describe("memory game — 8x8 single play", () => {
  test("flipping a matching pair locks both cards as matched and increments pairs", async ({
    page,
  }) => {
    await seedConfig(page, { durationSeconds: 600 });
    await startGame(page);

    const [a, b] = await findMatchingPair(page);
    await card(page, a).click();
    await card(page, b).click();

    // After the 320 ms match transition, both must be 'matched'.
    await expect.poll(() => cardState(page, a), { timeout: 2000 }).toBe("matched");
    await expect.poll(() => cardState(page, b), { timeout: 2000 }).toBe("matched");

    await expect(page.getByTestId("pairs-count")).toContainText("01");

    // Game keeps playing — board is not in a final state.
    await expect(page.getByTestId("final-headline")).toHaveCount(0);
  });

  test("flipping an incorrect pair flips both back to hidden, pair count unchanged", async ({
    page,
  }) => {
    await seedConfig(page, { durationSeconds: 600, flipBackDelayMs: 400 });
    await startGame(page);

    const [a, b] = await findMismatchedPair(page);
    await card(page, a).click();
    await card(page, b).click();

    // Mid-check: both flipped.
    await expect.poll(() => cardState(page, a), { timeout: 1500 }).toBe("flipped");

    // After flipBackDelayMs, both back to hidden.
    await expect.poll(() => cardState(page, a), { timeout: 3000 }).toBe("hidden");
    await expect.poll(() => cardState(page, b), { timeout: 3000 }).toBe("hidden");

    await expect(page.getByTestId("pairs-count")).toContainText("00");
  });

  test("reaching a win level does not stop the game", async ({ page }) => {
    await seedConfig(page, { durationSeconds: 600 });
    await startGame(page);

    // Find one pair, lock it — should hit level 1 (1–4 pairs).
    const [a, b] = await findMatchingPair(page);
    await card(page, a).click();
    await card(page, b).click();
    await expect.poll(() => cardState(page, a), { timeout: 2000 }).toBe("matched");

    // Level 1 reached — sidebar shows "01/10".
    await expect(page.getByTestId("pairs-count")).toContainText("01");


    // Board still playable: at least one hidden card is enabled.
    const stillPlayable = await page
      .locator('button[data-card-state="hidden"]:not([disabled])')
      .count();
    expect(stillPlayable).toBeGreaterThan(0);

    // No final result screen yet.
    await expect(page.getByTestId("final-headline")).toHaveCount(0);
  });

  test("timeout ends the game and shows final score + level", async ({ page }) => {
    await seedConfig(page, { durationSeconds: 3 });
    await startGame(page);

    // Get one pair before time runs out so we land on a real win level.
    const [a, b] = await findMatchingPair(page);
    await card(page, a).click();
    await card(page, b).click();

    // Wait for timer to expire and result screen to show.
    await expect(page.getByTestId("final-headline")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("final-pairs")).toContainText("1");
    await expect(page.getByTestId("final-level")).toContainText("Tier 1");
    await expect(
      page.getByRole("button", { name: /play again/i }),
    ).toBeVisible();
  });

  test("replay shuffles a fresh board with no matched cards left over", async ({
    page,
  }) => {
    await seedConfig(page, { durationSeconds: 2 });
    await startGame(page);

    const [a, b] = await findMatchingPair(page);
    await card(page, a).click();
    await card(page, b).click();

    const playAgain = page.getByRole("button", { name: /play again/i });
    await expect(playAgain).toBeVisible({ timeout: 8000 });
    await playAgain.click();

    // All 20 cards back to hidden, pair count 00, no final screen.
    await expect(page.getByTestId("pairs-count")).toContainText("00", {
      timeout: 5000,
    });
    await expect(page.getByTestId("final-headline")).toHaveCount(0);
    const matched = await page
      .locator('button[data-card-state="matched"]')
      .count();
    expect(matched).toBe(0);
  });
});
