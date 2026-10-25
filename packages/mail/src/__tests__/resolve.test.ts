import { createMock } from "@fuutu/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "../types";

const warnSpy = vi.hoisted(() => vi.fn());

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: warnSpy,
		error: vi.fn(),
	}),
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		EMAIL_PROVIDER: undefined,
		EMAIL_FROM: undefined,
		PLUNK_API_KEY: undefined,
		RESEND_API_KEY: undefined,
		NODE_ENV: "test",
	},
}));

const { env } = await import("@fuutu/env/saas");
const { resolveFromAddress, resolveProvider } = await import("../resolve");
const { emailConfig } = await import("../config/defaults");

const message = createMock<EmailMessage>({
	from: "noreply@fuutu.test",
	to: "user@fuutu.test",
	subject: "Test",
	html: "<p>Test</p>",
	text: "Test",
});

// `env` is typed readonly — Object.assign mutates the mock without a cast.
function setEnv(overrides: Partial<typeof env>): void {
	Object.assign(env, overrides);
}

beforeEach(() => {
	setEnv({
		EMAIL_PROVIDER: undefined,
		EMAIL_FROM: undefined,
		PLUNK_API_KEY: undefined,
		RESEND_API_KEY: undefined,
		NODE_ENV: "test",
	});
	warnSpy.mockClear();
});

describe("resolveProvider", () => {
	it("prefers the EMAIL_PROVIDER env override over emailConfig.provider", () => {
		setEnv({ EMAIL_PROVIDER: "noop" });
		expect(resolveProvider().name).toBe("noop");
	});

	it("falls back to emailConfig.provider when EMAIL_PROVIDER is unset", () => {
		setEnv({ PLUNK_API_KEY: "test-plunk-key" });
		expect(resolveProvider().name).toBe("plunk");
	});

	it("downgrades to console and warns when PLUNK_API_KEY is missing in test", () => {
		setEnv({ EMAIL_PROVIDER: "plunk", NODE_ENV: "test" });
		expect(resolveProvider().name).toBe("console");
		expect(warnSpy).toHaveBeenCalledOnce();
	});

	it("downgrades to console and warns when RESEND_API_KEY is missing in development", () => {
		setEnv({ EMAIL_PROVIDER: "resend", NODE_ENV: "development" });
		expect(resolveProvider().name).toBe("console");
		expect(warnSpy).toHaveBeenCalledOnce();
	});

	it("throws instead of downgrading when PLUNK_API_KEY is missing in production", () => {
		setEnv({ EMAIL_PROVIDER: "plunk", NODE_ENV: "production" });
		expect(() => resolveProvider()).toThrow(
			"[mail:plunk] PLUNK_API_KEY is not set",
		);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("throws instead of downgrading when RESEND_API_KEY is missing in production", () => {
		setEnv({ EMAIL_PROVIDER: "resend", NODE_ENV: "production" });
		expect(() => resolveProvider()).toThrow(
			"[mail:resend] RESEND_API_KEY is not set",
		);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	// env.NODE_ENV is a zod enum, so an out-of-band value can only appear if
	// the schema gains one (e.g. "staging") — the resolver must fail closed
	// for anything that is not an explicit dev/test context. Object.assign
	// bypasses the enum type to simulate that future value.
	it.each(["plunk", "resend"] as const)(
		"throws instead of downgrading when %s key is missing and NODE_ENV is not dev/test",
		(provider) => {
			Object.assign(env, { EMAIL_PROVIDER: provider, NODE_ENV: "staging" });
			expect(() => resolveProvider()).toThrow("[mail:");
			expect(warnSpy).not.toHaveBeenCalled();
		},
	);

	it("passes skeleton providers through — they throw on send", async () => {
		setEnv({ EMAIL_PROVIDER: "postmark" });
		const provider = resolveProvider();
		expect(provider.name).toBe("postmark");
		await expect(provider.send(message)).rejects.toThrow();
	});
});

describe("resolveFromAddress", () => {
	it("prefers the EMAIL_FROM env override over emailConfig.from", () => {
		setEnv({ EMAIL_FROM: "Custom <custom@fuutu.test>" });
		expect(resolveFromAddress()).toBe("Custom <custom@fuutu.test>");
	});

	it("falls back to emailConfig.from when EMAIL_FROM is unset", () => {
		expect(resolveFromAddress()).toBe(emailConfig.from);
	});
});
