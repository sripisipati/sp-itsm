import { expect, test } from "@playwright/test";

test("logs in, filters changes, creates one, and submits it", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@itsm.local");
  await page.getByLabel("Password").fill("ChangeMe!Dev1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "All Changes" }).click();
  await expect(page.getByRole("heading", { name: "Change Management" })).toBeVisible();
  await expect(page.getByText("Plan, assess, approve, schedule and manage IT changes")).toBeVisible();
  await expect(page.getByRole("link", { name: "CHG0001001" })).toBeVisible();

  const listResponse = page.waitForResponse((response) => response.url().includes("/api/v1/changes") && response.url().includes("type=EMERGENCY") && response.request().method() === "GET");
  await page.getByLabel("Filter type").click();
  await page.getByRole("option", { name: "EMERGENCY" }).click();
  const filtered = await listResponse;
  expect(filtered.ok()).toBe(true);
  await expect(page.getByRole("link", { name: /^CHG/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "Clear all" }).click();
  await page.getByRole("link", { name: "CHG0001001" }).click();
  await expect(page.getByRole("heading", { name: "CHG0001001" })).toBeVisible();

  await page.getByRole("link", { name: "All Changes" }).click();
  await page.getByRole("button", { name: "Add Change" }).click();
  const marker = `Lifecycle ${Date.now()}`;
  await page.getByLabel("Short description").fill(marker);
  await page.getByLabel("Detailed description").fill("Created in the browser to verify the change form, server number, and submit.");
  await page.getByLabel("Type").click();
  await page.getByRole("option", { name: "STANDARD" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: /^CHG\d{7}$/ })).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("PENDING_APPROVAL")).toBeVisible();
});
