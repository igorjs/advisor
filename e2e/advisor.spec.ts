// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

/**
 * End-to-end tests against the real running server with real DB and LLM.
 * No mocking: tests verify structural UI behaviour, not exact LLM output.
 * Timeouts are generous because LLM calls take 5-30 seconds.
 */
import { expect, test, type Page } from "@playwright/test";

const TEST_PROMPT =
  "I am an accountant, and my client is asking for advice on strategies to optimise his tax structure. " +
  "He and his partner have an income of $200,000 per year. They live in Sydney, Australia, and have no kids. " +
  "Please provide a detailed list of strategies that could minimise their tax.";

/** Submit the initial prompt from the landing page. */
async function submitFromLanding(page: Page, text: string) {
  await page.getByRole("textbox", { name: /prompt/i }).fill(text);
  await page.getByRole("button", { name: /Get Advice/i }).click();
}

/** Wait for an AI assistant reply (any bubble with the "AI" avatar). */
async function waitForAIReply(page: Page) {
  await expect(
    page.locator('[class*="rounded-full"]', { hasText: "AI" }).first(),
  ).toBeVisible({ timeout: 60_000 });
}

/** Wait for the chat input to be enabled (streaming finished). */
async function waitForInputReady(page: Page) {
  const chatInput = page.getByRole("textbox", { name: /Ask me anything/i });
  await expect(chatInput).toBeEnabled({ timeout: 60_000 });
  return chatInput;
}

/** Count assistant message bubbles. */
function assistantBubbles(page: Page) {
  return page.locator('[class*="rounded-tl-sm"][class*="bg-gray-100"]');
}

// ─── Landing Page ──────────────────────────────────────────────

test.describe("Landing Page", () => {
  test("renders title, subtitle, and prompt form", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Financial Advisor" })).toBeVisible();
    await expect(page.getByText("Get tax and finance expert advice powered by AI")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /prompt/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Get Advice/i })).toBeDisabled();
  });

  test("submit button enables when text is entered", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("textbox", { name: /prompt/i }).fill("Test");
    await expect(page.getByRole("button", { name: /Get Advice/i })).toBeEnabled();
  });
});

// ─── Conversation Flow ─────────────────────────────────────────

test.describe("Conversation Flow", () => {
  test("submitting a prompt navigates to /chat/:id", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, TEST_PROMPT);

    await expect(page).toHaveURL(/\/chat\/[a-f0-9-]+/, { timeout: 15_000 });
  });

  test("AI responds with at least one message", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, TEST_PROMPT);
    await waitForAIReply(page);

    await expect(assistantBubbles(page).first()).toBeVisible();
  });

  test("chat header shows New Chat button", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, TEST_PROMPT);
    await waitForAIReply(page);

    await expect(page.getByRole("button", { name: "New Chat" })).toBeVisible();
  });

  test("follow-up message appears in thread", async ({ page }) => {
    test.slow(); // Multi-turn: two LLM calls
    await page.goto("/");
    await submitFromLanding(page, TEST_PROMPT);
    await waitForAIReply(page);
    const chatInput = await waitForInputReady(page);

    // Send follow-up via button click (more reliable than keyboard shortcut)
    await chatInput.fill("They are both salaried employees.");
    await page.getByRole("button", { name: /Send/i }).click();

    await expect(page.getByText("They are both salaried employees.")).toBeVisible({ timeout: 10_000 });

    // Wait for a second AI response
    const initialCount = await assistantBubbles(page).count();
    await expect(async () => {
      const newCount = await assistantBubbles(page).count();
      expect(newCount).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 90_000 });
  });
});

// ─── Records Panel ─────────────────────────────────────────────

test.describe("Records Panel", () => {
  test("records appear after multi-turn conversation", async ({ page }) => {
    test.slow(); // Multi-turn: two LLM calls + record extraction
    await page.goto("/");
    await submitFromLanding(page, TEST_PROMPT);
    await waitForAIReply(page);

    const chatInput = await waitForInputReady(page);
    await chatInput.fill("Both salaried employees. They have shares and an investment property. No private health insurance.");
    await page.getByRole("button", { name: /Send/i }).click();

    // Wait for records to appear (the "strategies" count label)
    await expect(page.getByText(/\d+ strateg/i)).toBeVisible({ timeout: 90_000 });

    // At least one record card with Edit/Delete
    await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" }).first()).toBeVisible();
  });
});

// ─── Page Refresh ──────────────────────────────────────────────

test.describe("Page Refresh", () => {
  test("refreshing restores messages from server", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, "Persistence test prompt xyz");
    await waitForAIReply(page);
    await waitForInputReady(page);

    const chatUrl = page.url();

    // Hard refresh
    await page.goto(chatUrl);

    // User message should be restored from DB
    await expect(page.getByText("Persistence test prompt xyz")).toBeVisible({ timeout: 10_000 });

    // At least one AI bubble should be restored
    await expect(assistantBubbles(page).first()).toBeVisible({ timeout: 10_000 });
  });

  test("no raw [records:N] sentinel visible after refresh", async ({ page }) => {
    test.slow();
    await page.goto("/");
    await submitFromLanding(page, TEST_PROMPT);
    await waitForAIReply(page);

    const chatInput = await waitForInputReady(page);
    await chatInput.fill("Both salaried. Shares and property. No health insurance.");
    await page.getByRole("button", { name: /Send/i }).click();

    // Wait for response
    await expect(async () => {
      const count = await assistantBubbles(page).count();
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 60_000 });

    // Refresh and check no raw sentinel
    await page.goto(page.url());
    await expect(page.getByText("[records:")).not.toBeVisible();
  });
});

// ─── New Chat ──────────────────────────────────────────────────

test.describe("New Chat", () => {
  test("clicking New Chat returns to landing page", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, "Quick test");
    await waitForAIReply(page);

    await page.getByRole("button", { name: "New Chat" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("textbox", { name: /prompt/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Get Advice/i })).toBeVisible();
  });

  test("new chat clears previous messages", async ({ page }) => {
    test.slow(); // Two separate conversations with LLM calls
    await page.goto("/");
    await submitFromLanding(page, "First conversation unique marker");
    await waitForAIReply(page);
    await waitForInputReady(page);

    await page.getByRole("button", { name: "New Chat" }).click();
    await expect(page).toHaveURL("/");

    await submitFromLanding(page, "Second conversation");
    await waitForAIReply(page);

    await expect(page.getByText("Second conversation")).toBeVisible();
    await expect(page.getByText("First conversation unique marker")).not.toBeVisible();
  });
});

// ─── Chat Input UX ─────────────────────────────────────────────

test.describe("Chat Input UX", () => {
  test("Enter adds a newline, does not submit", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, "Test input behaviour");
    await waitForAIReply(page);
    const chatInput = await waitForInputReady(page);

    await chatInput.fill("Line one");
    await chatInput.press("Enter");

    // Input should still have text (not cleared by submit)
    await expect(chatInput).not.toHaveValue("");
  });

  test("chat input is enabled and focusable after AI responds", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, "Focus test");
    await waitForAIReply(page);

    const chatInput = await waitForInputReady(page);

    // Click the input to focus it explicitly
    await chatInput.click();
    await expect(chatInput).toBeFocused();
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, "Button state test");
    await waitForAIReply(page);

    await expect(page.getByRole("button", { name: /Send/i })).toBeDisabled();
  });
});

// ─── Message Editing ───────────────────────────────────────────

test.describe("Message Editing", () => {
  test("edit button appears on hover and opens edit form", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, "Editable message test");
    await waitForAIReply(page);
    await waitForInputReady(page);

    await page.getByText("Editable message test").hover();
    await expect(page.getByRole("button", { name: "Edit message" })).toBeVisible();

    await page.getByRole("button", { name: "Edit message" }).click();

    await expect(page.getByRole("button", { name: /Save & Resubmit/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("escape cancels edit mode", async ({ page }) => {
    await page.goto("/");
    await submitFromLanding(page, "Cancel edit test");
    await waitForAIReply(page);
    await waitForInputReady(page);

    await page.getByText("Cancel edit test").hover();
    await page.getByRole("button", { name: "Edit message" }).click();
    await page.keyboard.press("Escape");

    await expect(page.getByText("Cancel edit test")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save & Resubmit/i })).not.toBeVisible();
  });
});

// ─── URL Routing ───────────────────────────────────────────────

test.describe("URL Routing", () => {
  test("/chat/nonexistent shows not found error", async ({ page }) => {
    await page.goto("/chat/nonexistent-id-12345");

    // ErrorBanner shows the API error message for 404
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 10_000 });
  });
});
