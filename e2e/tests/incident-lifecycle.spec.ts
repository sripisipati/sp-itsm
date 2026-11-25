import { expect, test } from "@playwright/test";

test("creates, filters, and comments on an incident", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@itsm.local");
  await page.getByLabel("Password").fill("ChangeMe!Dev1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Total Incidents")).toBeVisible();

  await page.getByRole("link", { name: "All Incidents" }).click();
  await expect(page.getByRole("heading", { name: "Incident Management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "INC0001001" })).toBeVisible();

  await page.getByLabel("Filter ticketNumber").fill("INC0001001");
  await expect(page.getByRole("link", { name: "INC0001001" })).toBeVisible();
  await page.getByRole("link", { name: "INC0001001" }).click();
  await expect(page.getByText("Payroll VPN tunnel drops for the finance floor")).toBeVisible();
  await expect(page.getByText("Checked monitoring and recent changes")).toBeVisible();

  await page.getByRole("button", { name: "Add Additional Comment" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Customer update recorded by the lifecycle test.");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Customer update recorded by the lifecycle test.")).toBeVisible();

  await page.getByRole("link", { name: "All Incidents" }).click();
  await page.getByRole("button", { name: "Add Incident" }).click();
  await expect(page.getByRole("heading", { name: "Create Incident" })).toBeVisible();
  const marker = `Lifecycle ${Date.now()}`;
  await page.getByLabel("Short Description").fill(marker);
  await page.getByLabel("Detailed Description").fill("Created through the browser to verify the incident form and ticket number.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Edit Incident" })).toBeVisible();
  await expect(page.getByLabel("Ticket Number")).not.toHaveValue("Assigned when you save");
  await expect(page.getByLabel("Ticket Number")).toHaveValue(/^INC\d{7}$/);
});
