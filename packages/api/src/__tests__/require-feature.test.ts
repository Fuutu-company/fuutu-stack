import type { PlanId } from "@fuutu/payments/config";
import { paymentsConfig } from "@fuutu/payments/config";
import { fixturePlanId, makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * Feature flags gate the API, not only the sidebar: a module that is
 * switched off answers NOT_FOUND on every procedure of the mounted router
 * (before auth, so it does not even reveal it exists); switched on, the
 * request reaches the procedure (its own auth then answers UNAUTHORIZED
 * for the anonymous caller used here).
 */

const flags = vi.hoisted(() => ({ aiChat: true, crm: true, webhooks: true }));

vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			features: new Proxy(actual.config.features, {
				get: (target, prop, receiver) =>
					prop in flags
						? flags[prop as keyof typeof flags]
						: Reflect.get(target, prop, receiver),
			}),
		},
	};
});

// Fixed kit plan catalog (@fuutu/test-utils), not the app's PLANS.
vi.mock("@fuutu/payments/config", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments/config")>()),
	...(await import("@fuutu/test-utils")).planCatalogFixture,
}));

vi.mock("@fuutu/db", () => ({}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));
vi.mock("@fuutu/auth", () => ({ auth: { api: {} } }));

const { appRouter } = await import("../orpc/router");

const anonymous = makeSession<Context>(null);
const signedIn = makeSession<Context>(makeUser({ id: "user-flags" }));
const ORG_ID = "12345678-1234-1234-8123-123456789abc";
/** The gate's answer — distinct from a procedure's own NOT_FOUND. */
const GATED = { code: "NOT_FOUND", message: "Not found" };

const creditsEnabled = paymentsConfig.creditsEnabled;
afterEach(() => {
	flags.aiChat = true;
	flags.crm = true;
	flags.webhooks = true;
	paymentsConfig.creditsEnabled = creditsEnabled;
});

type Case = [name: string, run: (context: Context) => Promise<unknown>];

const CHAT: Case[] = [
	[
		"ai.chat",
		(c) =>
			call(
				appRouter.ai.chat,
				{ messages: [{ role: "user", content: "hi" }] },
				{ context: c },
			),
	],
	[
		"chat.conversations.list",
		(c) => call(appRouter.chat.conversations.list, {}, { context: c }),
	],
	[
		"chat.conversations.create",
		(c) => call(appRouter.chat.conversations.create, {}, { context: c }),
	],
	[
		"chat.messages.list",
		(c) =>
			call(
				appRouter.chat.messages.list,
				{ conversationId: ORG_ID },
				{ context: c },
			),
	],
];

const CRM: Case[] = [
	[
		"crm.contacts.list",
		(c) =>
			call(
				appRouter.crm.contacts.list,
				{ organizationId: ORG_ID },
				{ context: c },
			),
	],
	[
		"crm.contacts.create",
		(c) =>
			call(
				appRouter.crm.contacts.create,
				{ organizationId: ORG_ID, name: "Ada", email: "ada@example.com" },
				{ context: c },
			),
	],
];

const CREDITS: Case[] = [
	[
		"credits.balance",
		(c) => call(appRouter.credits.balance, {}, { context: c }),
	],
	[
		"credits.history",
		(c) => call(appRouter.credits.history, {}, { context: c }),
	],
	[
		"credits.packages",
		(c) => call(appRouter.credits.packages, {}, { context: c }),
	],
	[
		"payments.topupPackages.list",
		(c) => call(appRouter.payments.topupPackages.list, {}, { context: c }),
	],
	[
		"payments.topupCheckout.create",
		(c) =>
			call(
				appRouter.payments.topupCheckout.create,
				{ topupId: "ai_tokens_100k" },
				{ context: c },
			),
	],
];

const WEBHOOKS: Case[] = [
	[
		"webhooks.list",
		(c) =>
			call(appRouter.webhooks.list, { organizationId: ORG_ID }, { context: c }),
	],
	[
		"webhooks.create",
		(c) =>
			call(
				appRouter.webhooks.create,
				{
					organizationId: ORG_ID,
					url: "https://hooks.example.com/in",
					events: ["organization.updated"],
				},
				{ context: c },
			),
	],
	[
		"webhooks.deliveries.list",
		(c) =>
			call(
				appRouter.webhooks.deliveries.list,
				{ organizationId: ORG_ID, webhookId: ORG_ID },
				{ context: c },
			),
	],
];

describe("config.features.aiChat = false", () => {
	it.each(CHAT)("%s answers NOT_FOUND", async (_name, run) => {
		flags.aiChat = false;
		await expect(run(signedIn)).rejects.toMatchObject(GATED);
		await expect(run(anonymous)).rejects.toMatchObject(GATED);
	});

	it.each(CHAT)("%s is reachable when the flag is on", async (_name, run) => {
		await expect(run(anonymous)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});
});

describe("config.features.crm = false", () => {
	it.each(CRM)("%s answers NOT_FOUND", async (_name, run) => {
		flags.crm = false;
		await expect(run(signedIn)).rejects.toMatchObject(GATED);
	});

	it.each(CRM)("%s is reachable when the flag is on", async (_name, run) => {
		await expect(run(anonymous)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("leaves the chat module alone", async () => {
		flags.crm = false;
		await expect(
			call(appRouter.chat.conversations.list, {}, { context: anonymous }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("credits disabled (config.features.credits → paymentsConfig.creditsEnabled)", () => {
	it.each(CREDITS)("%s answers NOT_FOUND", async (_name, run) => {
		paymentsConfig.creditsEnabled = false;
		await expect(run(signedIn)).rejects.toMatchObject(GATED);
	});

	it.each(CREDITS)(
		"%s is reachable when credits are on",
		async (_name, run) => {
			await expect(run(anonymous)).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		},
	);

	it("leaves plan checkout alone", async () => {
		paymentsConfig.creditsEnabled = false;
		await expect(
			call(
				appRouter.payments.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro") },
				{ context: anonymous },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("config.features.webhooks = false", () => {
	it.each(WEBHOOKS)(
		"webhooks procedures answer NOT_FOUND when config.features.webhooks is false (%s)",
		async (_name, run) => {
			flags.webhooks = false;
			await expect(run(signedIn)).rejects.toMatchObject(GATED);
			await expect(run(anonymous)).rejects.toMatchObject(GATED);
		},
	);

	it.each(WEBHOOKS)(
		"%s is reachable when the flag is on",
		async (_name, run) => {
			await expect(run(anonymous)).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		},
	);

	it("leaves the payments module alone", async () => {
		flags.webhooks = false;
		await expect(
			call(
				appRouter.payments.subscription.cancel,
				{ subscriptionId: "sub-1" },
				{ context: anonymous },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
