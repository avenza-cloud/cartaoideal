import { expect, test, type Page } from "@playwright/test";

const firstCardId = "bradesco-bradesco-american-express-the-centurion-card-6d6ffcfe73";
const secondCardId = "xp-investimentos-xp-visa-infinite-privilege-versao-cashback-99a6f9cd19";

async function expectNoHorizontalOverflow(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
  });
  expect(hasOverflow).toBe(false);
}

test.describe("mobile compatibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "credit-card-profile",
        JSON.stringify({ state: { profile: null, onboardingDone: true }, version: 0 })
      );
    });
  });

  test("home uses new brand and has no page overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Meu Cartão Ideal").first()).toBeVisible();
    await expect(page.locator("header").getByText("💳")).toBeVisible();
    await expect(page).toHaveTitle(/Meu Cartão Ideal/);
    await expectNoHorizontalOverflow(page);
  });

  test("header navigation reaches catalog and profile", async ({ page }) => {
    await page.goto("/");
    await page.locator('header a[href="/cartoes"]').first().click();
    await expect(page).toHaveURL(/\/cartoes/);
    await expectNoHorizontalOverflow(page);

    await page.locator('header a[href="/perfil"]').click();
    await expect(page).toHaveURL(/\/perfil/);
    await expect(page.getByRole("heading", { name: /Configure seu perfil|Editar perfil/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("catalog filters and cards stay inside the viewport", async ({ page }) => {
    await page.goto("/cartoes");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const mobileFilters = page.locator("aside details").first();
    if (await mobileFilters.isVisible()) {
      await mobileFilters.locator("summary").click();
    }
    await page.getByRole("button", { name: "Premium", exact: true }).click();
    await expect(page).toHaveURL(/segment=premium/);
    await expect(page.getByRole("link").filter({ hasText: /Visa|Mastercard|American Express|Elo|Hipercard/ }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("card detail bottom actions are tappable", async ({ page }) => {
    await page.goto(`/cartoes/${firstCardId}`);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Comparar/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Fonte/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("comparison table scrolls internally without page overflow", async ({ page }) => {
    await page.goto(`/comparar?ids=${firstCardId},${secondCardId}`);
    await expect(page.getByRole("heading", { name: "Comparar Cartões" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("profile form controls fit mobile", async ({ page }) => {
    await page.goto("/perfil");
    await page.getByPlaceholder("Ex: 8.000").fill("8000");
    await page.getByRole("button", { name: "Cashback" }).click();
    await page.getByRole("button", { name: "Às vezes" }).click();
    await expectNoHorizontalOverflow(page);
  });

  test("chat shell renders without AI backend calls", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "Assistente de Cartões" })).toBeVisible();
    await expect(page.getByPlaceholder("Pergunte sobre cartões...")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("chat sends the saved financial profile with each message", async ({ page }) => {
    const profile = {
      monthlySalaryBrl: 18000,
      avgMonthlySpendBrl: 6200,
      avgInvestedBrl: 275000,
      monthlyInternationalSpendBrl: 850,
      travelFrequency: "frequent",
      spendingCategories: [],
      preferences: {
        wantsLounge: true,
        prefersCashback: false,
        prefersPoints: true,
        prefersInvestback: false,
      },
    };

    await page.addInitScript((storedProfile) => {
      window.localStorage.setItem(
        "credit-card-profile",
        JSON.stringify({
          state: { profile: storedProfile, onboardingDone: true },
          version: 0,
        })
      );
    }, profile);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: "",
      });
    });

    await page.goto("/chat");
    const requestPromise = page.waitForRequest("**/api/chat");
    await page.getByPlaceholder("Pergunte sobre cartões...").fill("Compare meus cartões para meu perfil");
    await page.getByPlaceholder("Pergunte sobre cartões...").press("Enter");

    const request = await requestPromise;
    const body = request.postDataJSON();
    expect(body.profile).toMatchObject(profile);
  });
});
