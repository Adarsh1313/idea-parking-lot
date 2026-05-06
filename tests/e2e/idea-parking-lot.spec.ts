import { expect, test } from "@playwright/test";

async function startIdeaInSlot(page: import("@playwright/test").Page, slotLabel: string) {
  await page
    .getByRole("button", { name: `Start idea in ${slotLabel}`, exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
}

test("creates, inspects, activates, and edits an idea", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("0/16 parked")).toBeVisible();
  await startIdeaInSlot(page, "P-03");
  await expect(page.getByText("New idea")).toBeVisible();

  await page.getByLabel("Idea ID").fill("IDEA-LAUNCH");
  await page.getByLabel("Title").fill("A tiny launch tracker");
  await page.getByLabel("Description").fill("Keep launch ideas from evaporating overnight.");
  await page.getByLabel("Links").fill("https://example.com", { force: true });
  await page.getByRole("button", { name: "Approve parking" }).click({ force: true });

  await expect(page.getByText("1/16 parked")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("A tiny launch tracker");
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("IDEA-LAUNCH");

  await page.getByRole("button", { name: "Set active" }).click({ force: true });
  await expect(page.getByText("1 active")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click({ force: true });
  await page.getByLabel("Title").fill("A tiny launch tracker v2");
  await page.getByRole("button", { name: "Save changes" }).click({ force: true });
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("v2");
});

test("canceling a pending idea leaves the lot empty", async ({ page }) => {
  await page.goto("/");

  await startIdeaInSlot(page, "P-04");
  await expect(page.getByText("New idea")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click({ force: true });

  await expect(page.getByText("0/16 parked")).toBeVisible();
  await expect(page.getByText("New idea")).not.toBeVisible();
});
