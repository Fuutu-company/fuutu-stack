import { generateText, streamText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every functional provider caps the reply length by default — an
 * unbounded `maxOutputTokens` lets one request burn the model's full
 * output window on the operator's key.
 */

vi.mock("@ai-sdk/devtools", () => ({ devToolsMiddleware: vi.fn(() => ({})) }));
vi.mock("@ai-sdk/google", () => ({
	createGoogleGenerativeAI: vi.fn(() => (model: string) => ({
		modelId: model,
	})),
}));
vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: vi.fn(() => (model: string) => ({ modelId: model })),
}));
vi.mock("ai", () => ({
	wrapLanguageModel: vi.fn(({ model }) => model),
	generateText: vi.fn(async () => ({ text: "ok" })),
	streamText: vi.fn(() => ({
		toTextStreamResponse: () => ({ body: null }),
	})),
}));
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const { GoogleProvider } = await import("../providers/google");
const { OpenRouterProvider } = await import("../providers/openrouter");

const messages = [{ role: "user" as const, content: "Hi" }];

const providers = [
	[
		"openrouter",
		(o?: { maxOutputTokens?: number }) =>
			new OpenRouterProvider({ apiKey: "k", ...o }),
	],
	[
		"google",
		(o?: { maxOutputTokens?: number }) =>
			new GoogleProvider({ apiKey: "k", ...o }),
	],
] as const;

beforeEach(() => {
	vi.clearAllMocks();
});

describe.each(providers)("%s provider output cap", (_name, create) => {
	it("stream() sends maxOutputTokens 1024 when the caller sets none", async () => {
		await create().stream(messages);
		expect(streamText).toHaveBeenCalledWith(
			expect.objectContaining({ maxOutputTokens: 1024 }),
		);
	});

	it("chat() sends maxOutputTokens 1024 when the caller sets none", async () => {
		await create().chat(messages);
		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({ maxOutputTokens: 1024 }),
		);
	});

	it("uses the configured cap from the constructor", async () => {
		await create({ maxOutputTokens: 256 }).stream(messages);
		expect(streamText).toHaveBeenCalledWith(
			expect.objectContaining({ maxOutputTokens: 256 }),
		);
	});

	it("an explicit per-call maxTokens wins", async () => {
		await create().stream(messages, { maxTokens: 64 });
		expect(streamText).toHaveBeenCalledWith(
			expect.objectContaining({ maxOutputTokens: 64 }),
		);
	});
});
