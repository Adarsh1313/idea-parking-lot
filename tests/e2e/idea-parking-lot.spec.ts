import { expect, test } from "@playwright/test";

const EMPTY_SHARED_EXPORT = {
  schemaVersion: 1,
  ideas: []
};

test.beforeEach(async ({ page }) => {
  await page.route("https://raw.githubusercontent.com/**/data/ideas.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPTY_SHARED_EXPORT)
    });
  });

  await page.route("https://api.github.com/repos/Adarsh1313/idea-parking-lot/contents/data/ideas.json**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 404, body: "" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true })
    });
  });
});

async function unlockOwnerMode(page: import("@playwright/test").Page) {
  const continueButton = page.getByRole("button", { name: "Continue" });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  }

  await page.getByLabel("Owner email").fill("adarshbharathwaj13@gmail.com");
  await page.getByLabel("Owner password").fill("bAdi@@200213");
  await page.getByRole("button", { name: "Unlock editing" }).click();
}

async function startIdeaInSlot(page: import("@playwright/test").Page, slotLabel: string) {
  await page
    .getByRole("button", { name: `Start idea in ${slotLabel}`, exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
}

async function openIdeaInSlot(page: import("@playwright/test").Page, slotLabel: string) {
  await page
    .getByRole("button", { name: `Open idea in ${slotLabel}`, exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
}

async function openArchivedIdea(page: import("@playwright/test").Page, ideaId: string) {
  await page
    .getByRole("button", { name: `Open archived idea ${ideaId}`, exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
}

test("creates, inspects, activates, and edits an idea", async ({ page }) => {
  await page.goto("/");

  await unlockOwnerMode(page);
  await expect(page.getByText("0/20 parked")).toBeVisible();
  await expect(page.locator(".slot-number").filter({ hasText: "ADA" })).toHaveCount(0);
  await expect(page.locator(".slot-number").filter({ hasText: "RES" })).toHaveCount(0);
  await expect(page.locator(".slot-number").filter({ hasText: "LOAD" })).toHaveCount(0);
  await startIdeaInSlot(page, "P-03");
  await expect(page.getByText("New idea")).toBeVisible();
  await expect(page.locator(".slot-number")).toHaveCount(0);

  await page.getByLabel("Idea ID").fill("IDEA-LAUNCH");
  await page.getByLabel("Title").fill("A tiny launch tracker");
  await page.getByLabel("Description").fill("Keep launch ideas from evaporating overnight.");
  await page.getByLabel("Links").fill("https://example.com", { force: true });
  await page.getByRole("button", { name: "Approve parking" }).click({ force: true });

  await expect(page.getByText("1/20 parked")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("A tiny launch tracker");
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("IDEA-LAUNCH");

  await page.getByRole("button", { name: "Set active" }).click({ force: true });
  await expect(page.getByText("1 active")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click({ force: true });
  await page.getByLabel("Title").fill("A tiny launch tracker v2");
  await page.getByRole("button", { name: "Save changes" }).click({ force: true });
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("v2");
  await page.getByRole("button", { name: "Close idea details" }).click({ force: true });

  await openIdeaInSlot(page, "P-03");
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("IDEA-LAUNCH");
});

test("archived ideas stay visible as selectable broken-down cars", async ({ page }) => {
  await page.goto("/");

  await unlockOwnerMode(page);
  await startIdeaInSlot(page, "P-03");
  await page.getByLabel("Idea ID").fill("IDEA-ARCHIVE");
  await page.getByLabel("Title").fill("Archived roadside experiment");
  await page.getByRole("button", { name: "Approve parking" }).click({ force: true });

  await page.getByRole("button", { name: "Archive" }).click({ force: true });
  await expect(page.getByText("1 archived")).toBeVisible();
  await page.getByRole("button", { name: "Close idea details" }).click();

  await openArchivedIdea(page, "IDEA-ARCHIVE");
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("Archived roadside experiment");
  await expect(page.getByRole("complementary", { name: "Selected idea" })).toContainText("Archived");
});

test("canceling a pending idea leaves the lot empty", async ({ page }) => {
  await page.goto("/");

  await unlockOwnerMode(page);
  await startIdeaInSlot(page, "P-04");
  await expect(page.getByText("New idea")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click({ force: true });

  await expect(page.getByText("0/20 parked")).toBeVisible();
  await expect(page.getByText("New idea")).not.toBeVisible();
});

test("ambient mode shows the passive lot watcher", async ({ page }) => {
  await page.goto("/?ambient=1");

  await expect(page.getByLabel("Ambient parking lot status")).toContainText("0/20");
  await expect(page.getByRole("button", { name: "Export" })).not.toBeVisible();
  await expect(page.getByText("Park sparks before they vanish.")).not.toBeVisible();
});

test("viewer intro can be dismissed for read-only browsing", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Viewer welcome")).toBeVisible();
  await expect(page.getByLabel("Idea lot story")).toContainText("Peek at Adarsh's idea lot.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("region", { name: "Owner login" })).toContainText("Owner sessions stay unlocked on this browser for 30 days.");
  await page.getByRole("button", { name: "View only" }).click();
  await expect(page.getByLabel("Viewer welcome")).not.toBeVisible();
  await expect(page.getByRole("complementary", { name: "Selected idea" })).not.toBeVisible();
});
