import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	env: {
		AI_PROVIDER: "openrouter" as string,
		AI_API_KEY: undefined as string | undefined,
		AI_BASE_URL: undefined as string | undefined,
		AI_MODEL: undefined as string | undefined,
		GOOGLE_GENERATIVE_AI_API_KEY: undefined as string | undefined,
		NODE_ENV: "test",
	},
}));

vi.mock("@fuutu/env/saas", () => ({ env: mocks.env }));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => (model: string) => ({ modelId: model })),
}));

vi.mock("@ai-sdk/google", () => ({
	createGoogleGenerativeAI: vi.fn(() => (model: string) => ({
		modelId: model,
	})),
}));

const { resolveAIProvider } = await import("../provider");

describe("resolveAIProvider", () => {
	beforeEach(() => {
		mocks.env.AI_PROVIDER = "openrouter";
		mocks.env.AI_API_KEY = undefined;
		mocks.env.GOOGLE_GENERATIVE_AI_API_KEY = undefined;
	});

	it("throws a clear error when openrouter is active but AI_API_KEY is missing", () => {
		expect(() => resolveAIProvider()).toThrow(/AI_API_KEY/);
	});

	it("throws a clear error when google is active but no key is set", () => {
		mocks.env.AI_PROVIDER = "google";
		expect(() => resolveAIProvider()).toThrow(/API_KEY/);
	});

	it("returns the noop provider when AI_PROVIDER=noop without a key", () => {
		mocks.env.AI_PROVIDER = "noop";
		expect(resolveAIProvider().id).toBe("noop");
	});

	it("returns the openrouter provider when a key is set", () => {
		mocks.env.AI_API_KEY = "test-key";
		expect(resolveAIProvider().id).toBe("openrouter");
	});
});
