import { expect, test } from "@playwright/test";

const PROFILE_WITH_10K = JSON.stringify({
  state: {
    profile: {
      monthlySalaryBrl: 10000,
      avgMonthlySpendBrl: 3000,
      avgInvestedBrl: 10000,
      monthlyInternationalSpendBrl: 0,
      travelFrequency: "none",
      spendingCategories: [],
      preferences: {
        wantsLounge: false,
        prefersCashback: true,
        prefersPoints: false,
        prefersInvestback: false,
      },
    },
    onboardingDone: true,
  },
  version: 0,
});

test.describe("chat — fee waiver investment query", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((profile) => {
      window.localStorage.setItem("credit-card-profile", profile);
    }, PROFILE_WITH_10K);
  });

  test("returns multiple card issuers, not just C6", async ({ page }) => {
    await page.goto("/");

    const input = page.getByRole("textbox").first();
    await input.fill("Quais cartões consigo isentar a anuidade com investimento?");
    await page.keyboard.press("Enter");

    // Wait for at least one assistant message to appear
    await page.waitForSelector('[data-testid="chat-message-assistant"]', {
      timeout: 40_000,
    });
    // Wait for streaming to finish (no more loading indicators)
    await page.waitForFunction(() => !document.querySelector('[data-testid="chat-loading"]'), {
      timeout: 40_000,
    });

    const lastMessage = page.locator('[data-testid="chat-message-assistant"]').last();
    const text = (await lastMessage.textContent()) ?? "";

    // Must mention at least 3 different issuers besides C6
    const knownIssuers = [
      "Nubank",
      "Porto Bank",
      "BTG",
      "Bradesco",
      "Santander",
      "PicPay",
      "Banescard",
      "Safra",
      "Itaú",
    ];
    const found = knownIssuers.filter((name) => text.includes(name));
    expect(
      found.length,
      `Expected ≥3 issuers, found: ${found.join(", ")}\n\nResponse: ${text.slice(0, 500)}`
    ).toBeGreaterThanOrEqual(3);
  });
});
