import { expect, test } from "@playwright/test";
import { athleteId, coachId, installSession, mockPlatformApi } from "./platform-helpers";

test("cliente mantiene piano, Health, analisi e inbox anche dopo reload offline", async ({ page, context }, testInfo) => {
  await installSession(page, athleteId, "alex@example.com");
  await mockPlatformApi(page, "athlete");
  await page.goto("/");
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Piano Hybrid test|Corsa facile/).first()).toBeVisible();

  await page.getByRole("button", { name: "Analisi" }).click();
  await expect(page.getByRole("heading", { name: "Fonti dei dati" })).toBeVisible();
  await expect(page.getByText(/apple health/i).first()).toBeVisible();
  await expect(page.getByText(/nessuna serie inventata/i)).toBeVisible();

  await page.getByRole("button", { name: /Avvisi/ }).click();
  await expect(page.getByText("Il tuo piano è stato aggiornato")).toBeVisible();
  await page.getByRole("button", { name: "Apri avviso: Il tuo piano è stato aggiornato" }).click();
  await expect(page.getByRole("button", { name: "Oggi" })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\?tab=today$/);
  await page.getByRole("button", { name: /Avvisi/ }).click();
  await page.screenshot({ path: `/tmp/roberta-athlete-${testInfo.project.name}.png`, fullPage: true });

  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.reload();
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Modalità offline/)).toBeVisible();
  await context.setOffline(false);
});

test("trainer apre il cliente e modifica una copia strutturata della corsa", async ({ page }, testInfo) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await installSession(page, coachId, "trainer@example.com");
  await mockPlatformApi(page, "coach");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Clienti", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apri dettaglio" }).click();
  await expect(page.getByText("88%")).toBeVisible();
  await expect(page.getByText("Piano Hybrid test")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  if (testInfo.project.name !== "desktop-chromium") return;

  await page.getByRole("button", { name: "Piani" }).click();
  await page.waitForTimeout(500);
  expect(pageErrors, pageErrors.map((error) => error.stack ?? error.message).join("\n\n")).toEqual([]);
  await expect(page.getByRole("heading", { name: "Studio piani" })).toBeVisible();
  const runArticle = page.locator(".week-list article").filter({
    has: page.getByRole("textbox", { name: "Allenamento (run)" }),
  }).first();
  await runArticle.getByRole("button", { name: /Modifica esercizi/ }).click();
  await runArticle.getByLabel("Workout dalla libreria").selectOption("run-template-intervals-400");
  await expect(runArticle.getByText("Segmento 1")).toBeVisible();
  await runArticle.getByLabel("Ritmo target").first().fill("6:00/km");
  await expect(runArticle.getByLabel("Ritmo target").first()).toHaveValue("6:00/km");
  await page.screenshot({ path: "/tmp/roberta-trainer-builder-desktop.png", fullPage: true });
});

test("invito web completa login e mostra onboarding condiviso", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Il primo accesso viene provato sul viewport mobile principale.");
  await mockPlatformApi(page, "athlete", false);
  await page.goto("/");
  await page.getByLabel("Email").fill("alex@example.com");
  await page.getByLabel("Password").fill("password-test-123");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Partiamo da te." })).toBeVisible();
  await page.getByLabel("Nome o nickname").fill("Alex");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Quando ti alleni?" })).toBeVisible();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Collega Health." })).toBeVisible();
  await page.getByRole("button", { name: "Continua senza Health" }).click();
  const enter = page.getByRole("button", { name: "Entra nell’app" });
  await expect(enter).toBeDisabled();
  await page.getByLabel(/non sostituisce medico/i).check();
  await expect(enter).toBeDisabled();
  await page.getByLabel(/informativa privacy/i).check();
  await expect(enter).toBeEnabled();
  await enter.click();
  await expect(page.getByText("Alex", { exact: true }).first()).toBeVisible();
});

test("admin vede analisi operative senza dettagli sanitari individuali", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Il controllo privacy admin viene eseguito una volta sul layout desktop.");
  await installSession(page, coachId, "admin@example.com");
  await mockPlatformApi(page, "admin");
  await page.goto("/");
  await page.getByRole("button", { name: "Analisi" }).click();
  await expect(page.getByRole("heading", { name: "Analisi operative" })).toBeVisible();
  await expect(page.getByText(/dettagli atleta protetti/i)).toBeVisible();
  await expect(page.getByLabel("Cliente")).toHaveCount(0);
  await expect(page.getByText("Private rationale")).toHaveCount(0);
});
