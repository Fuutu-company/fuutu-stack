import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, streamText, wrapLanguageModel } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/devtools", () => ({
	devToolsMiddleware: vi.fn(() => ({})),
}));

vi.mock("@ai-sdk/google", () => ({
	createGoogleGenerativeAI: vi.fn(() => {
		const model = (modelName: string) => ({ modelId: modelName });
		return Object.assign(model, { id: "google" });
	}),
}));

vi.mock("ai", () => ({
	wrapLanguageModel: vi.fn(({ model }) => model),
	generateText: vi.fn(),
	streamText: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NODE_ENV: "development",
		AI_API_KEY: "test-key",
		GOOGLE_GENERATIVE_AI_API_KEY: undefined,
	},
}));

const { GoogleProvider } = await import("../providers/google");

const sampleMessages = [
	{ role: "user" as const, content: "Hello, what is Fuutu Stack?" },
];

describe("GoogleProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("constructs with the configured model and apiKey", () => {
		new GoogleProvider({ apiKey: "test-key", model: "gemini-2.0-flash" });

		expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
			apiKey: "test-key",
		});
		expect(devToolsMiddleware).toHaveBeenCalled();
		expect(wrapLanguageModel).toHaveBeenCalled();
	});

	it("chat() returns the generated text as an assistant response", async () => {
		vi.mocked(generateText).mockResolvedValue({
			text: "Fuutu Stack is a SaaS starter kit.",
		} as never);

		const provider = new GoogleProvider({ apiKey: "test-key" });
		const response = await provider.chat(sampleMessages);

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({ messages: sampleMessages }),
		);
		expect(response).toEqual({
			content: "Fuutu Stack is a SaaS starter kit.",
			role: "assistant",
		});
	});

	it("stream() returns a ReadableStream from the SDK response body", async () => {
		const fakeBody = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.close();
			},
		});
		vi.mocked(streamText).mockReturnValue({
			toUIMessageStreamResponse: () =>
				({
					body: fakeBody,
				}) as never,
		} as never);

		const provider = new GoogleProvider({ apiKey: "test-key" });
		const stream = await provider.stream(sampleMessages);

		expect(streamText).toHaveBeenCalledWith(
			expect.objectContaining({ messages: sampleMessages }),
		);
		expect(stream).toBe(fakeBody);
	});

	it("stream() returns an empty stream when the SDK response has no body", async () => {
		vi.mocked(streamText).mockReturnValue({
			toUIMessageStreamResponse: () => ({}) as never,
		} as never);

		const provider = new GoogleProvider({ apiKey: "test-key" });
		const stream = await provider.stream(sampleMessages);

		expect(stream).toBeInstanceOf(ReadableStream);
	});

	it("chat() rethrows SDK errors", async () => {
		vi.mocked(generateText).mockRejectedValue(
			new Error("API key invalid") as never,
		);

		const provider = new GoogleProvider({ apiKey: "bad-key" });
		await expect(provider.chat(sampleMessages)).rejects.toThrow(
			"API key invalid",
		);
	});
});
