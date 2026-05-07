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

  test("catalog can switch between profile and general ranking", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "credit-card-profile",
        JSON.stringify({
          state: {
            onboardingDone: true,
            profile: {
              monthlySalaryBrl: 22000,
              avgMonthlySpendBrl: 7000,
              avgInvestedBrl: 300000,
              monthlyInternationalSpendBrl: 500,
              travelFrequency: "frequent",
              spendingCategories: [],
              preferences: {
                wantsLounge: true,
                prefersCashback: false,
                prefersPoints: true,
                prefersInvestback: false,
              },
            },
          },
          version: 0,
        })
      );
    });

    await page.goto("/cartoes");
    await expect(page.getByText("Classificado para o seu perfil")).toBeVisible();

    const mobileFilters = page.locator("aside details").first();
    if (await mobileFilters.isVisible()) {
      await mobileFilters.locator("summary").click();
    }
    await page.getByTitle("Ordenar pelo ranking geral").filter({ visible: true }).click();
    await expect(page).toHaveURL(/rank=general/);
    await expect(page.getByText("Ranking geral")).toBeVisible();
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
    const salary = page.getByPlaceholder("Ex: 8.000");
    const spend = page.getByPlaceholder("Ex: 3.000");
    const invested = page.getByPlaceholder("Ex: 50.000");
    await salary.fill("40000");
    await spend.fill("12000");
    await invested.fill("300000");
    await expect(salary).toHaveValue("40.000");
    await expect(spend).toHaveValue("12.000");
    await expect(invested).toHaveValue("300.000");
    await page.getByRole("button", { name: "Cashback" }).click();
    await page.getByRole("button", { name: "Às vezes" }).click();
    await expectNoHorizontalOverflow(page);
  });

  test("progression estimated spend keeps BRL scale and cents", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "credit-card-profile",
        JSON.stringify({
          state: {
            onboardingDone: true,
            profile: {
              monthlySalaryBrl: 40000,
              avgMonthlySpendBrl: 149333.57142857142,
              avgInvestedBrl: 270000,
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
          },
          version: 0,
        })
      );
    });
    await page.route("**/api/recommend", async (route) => {
      await route.fulfill({ status: 200, headers: { "Content-Type": "application/json" }, body: "[]" });
    });

    await page.goto("/");
    await page.getByPlaceholder("Atual: R$40.000").fill("56000");
    await expect(page.getByText("Gasto estimado")).toBeVisible();
    await expect(page.getByText("R$20.906,70/mês")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("chat shell renders without AI backend calls", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "Assistente de Cartões" })).toBeVisible();
    await expect(page.getByPlaceholder("Pergunte sobre cartões...")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("chat history opens a saved conversation in a modal", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "credit-card-chat-history",
        JSON.stringify([
          {
            id: "chat-test-history",
            title: "Comparar cartões para meu perfil",
            updatedAt: Date.now(),
            messages: [
              {
                id: "message-user",
                role: "user",
                parts: [{ type: "text", text: "Compare cartões para meu perfil" }],
              },
              {
                id: "message-assistant",
                role: "assistant",
                parts: [{ type: "text", text: "A melhor opção depende do seu gasto mensal." }],
              },
            ],
          },
        ])
      );
    });

    await page.goto("/chat");
    await page.getByTitle("Histórico").click();
    await expect(page.getByText("Histórico")).toBeVisible();
    await page.getByRole("button", { name: /Comparar cartões para meu perfil/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comparar cartões para meu perfil" })).toBeVisible();
    await expect(page.getByText("A melhor opção depende do seu gasto mensal.")).toBeVisible();
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
