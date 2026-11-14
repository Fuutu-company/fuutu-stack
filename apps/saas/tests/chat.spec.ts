import type { Page } from "@playwright/test";
import { featureOff } from "./features";
import { expect, test } from "./fixtures";

test.skip(...featureOff("aiChat"));

test.describe("AI chat", () => {
	test("chat page renders with title and conversation sidebar", async ({
		page,
	}) => {
		await page.goto("/chat");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		await expect(page.getByRole("heading", { name: /ai chat/i })).toBeVisible({
			timeout: 10_000,
		});

		// Sidebar has a "New conversation" button
		await expect(
			page.getByRole("button", { name: /new conversation/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("chat shows empty conversation placeholder before any conversation is selected", async ({
		page,
	}) => {
		await page.goto("/chat");

		await expect(
			page.getByText(/start a conversation by sending a message below/i),
		).toBeVisible({ timeout: 10_000 });
	});

	test("can create a conversation, type a message, and see it appear", async ({
		page,
	}) => {
		// Mock the AI streaming endpoint — no API key needed in CI. The body
		// is the oRPC event stream the server sends (one text chunk per
		// event; wire shape covered by packages/api chat-stream-wire.test.ts).
		await page.route("**/api/rpc/chat/messages/stream", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: [
					'event: message\ndata: {"json":"This is a mocked "}\n\n',
					'event: message\ndata: {"json":"AI response."}\n\n',
					"event: done\n\n",
				].join(""),
			});
		});

		await page.goto("/chat");

		// Create a new conversation
		const newConversationButton = page.getByRole("button", {
			name: /new conversation/i,
		});
		await expect(newConversationButton).toBeVisible({ timeout: 10_000 });
		await newConversationButton.click();

		// Message input becomes enabled once a conversation is active
		const messageInput = page.getByPlaceholder(/type your message/i);
		await expect(messageInput).toBeVisible({ timeout: 10_000 });
		await expect(messageInput).toBeEnabled({ timeout: 10_000 });

		// Type a message
		const testMessage = "Hello from the E2E test";
		await messageInput.fill(testMessage);

		// Send button has title "Send" — used as accessible name for icon button
		const sendButton = page.getByRole("button", { name: /^send$/i });
		await expect(sendButton).toBeEnabled();

		// Click should work without DevTools overlay blocking it
		await sendButton.click();

		// The send was accepted: the input clears
		await expect(messageInput).toHaveValue("");

		// The user message appears immediately in the message list (optimistic update)
		await expect(page.getByText(testMessage)).toBeVisible({
			timeout: 10_000,
		});

		// Regression: the reply used to arrive as `{"json":{}}` and never render.
		await expect(page.getByText("This is a mocked AI response.")).toBeVisible({
			timeout: 10_000,
		});
	});

	/** Opens /chat, creates a conversation and sends one message. */
	async function sendInNewConversation(page: Page) {
		await page.goto("/chat");
		await page.getByRole("button", { name: /new conversation/i }).click();
		const input = page.getByPlaceholder(/type your message/i);
		await expect(input).toBeEnabled({ timeout: 10_000 });
		await input.fill("Hello from the E2E test");
		await page.getByRole("button", { name: /^send$/i }).click();
	}

	test("a reply cut off by a server error keeps the partial text and says sending failed", async ({
		page,
	}) => {
		// Wire shape of a provider error mid-stream (chat-stream-wire.test.ts).
		await page.route("**/api/rpc/chat/messages/stream", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: [
					'event: message\ndata: {"json":"A partial answer"}\n\n',
					'event: error\ndata: {"json":{"defined":false,"code":"INTERNAL_SERVER_ERROR","status":500,"message":"Internal server error"}}\n\n',
				].join(""),
			});
		});

		await sendInNewConversation(page);

		await expect(page.getByText("A partial answer")).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/failed to send message/i)).toBeVisible({
			timeout: 10_000,
		});
	});

	test("an exhausted AI credit balance shows a credits message", async ({
		page,
	}) => {
		// Wire shape of the API's credit gate (chat-credits.test.ts).
		await page.route("**/api/rpc/chat/messages/stream", async (route) => {
			await route.fulfill({
				status: 402,
				contentType: "application/json",
				body: JSON.stringify({
					json: {
						defined: false,
						code: "PAYMENT_REQUIRED",
						status: 402,
						message: "AI credits exhausted",
						data: { meterKey: "ai_tokens" },
					},
				}),
			});
		});

		await sendInNewConversation(page);

		await expect(page.getByText(/used up your ai credits/i)).toBeVisible({
			timeout: 10_000,
		});
	});
});

test.describe("AI chat on a phone-width viewport", () => {
	test.use({ viewport: { width: 375, height: 800 } });

	test("conversation list collapses into a drawer and messages get the full width", async ({
		page,
	}) => {
		await page.goto("/chat");
		const input = page.getByPlaceholder(/type your message/i);
		await expect(input).toBeVisible({ timeout: 10_000 });

		const box = await input.boundingBox();
		expect(box?.width ?? 0).toBeGreaterThan(250);

		await page.getByRole("button", { name: /^conversations$/i }).click();
		const drawer = page.getByRole("dialog", { name: /conversations/i });
		await expect(drawer).toBeVisible();
		await expect(
			drawer
				.locator('[data-slot="button"]')
				.filter({ hasText: /new conversation/i }),
		).toBeVisible();

		await page.getByRole("button", { name: /close conversations/i }).click();
		await expect(drawer).toBeHidden();
	});
});
