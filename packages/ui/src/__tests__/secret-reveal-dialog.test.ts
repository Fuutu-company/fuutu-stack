import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "../components/secret-reveal/copy-to-clipboard";
import { SecretField } from "../components/secret-reveal/secret-field";

const SECRET = "futu_sk_Q2xhdWRlIHdhcyBoZXJlIGFuZCBpdCBpcyBsb25n";

const labels = {
	copy: "Copy key",
	copied: "Copied!",
	copyFailed: "Copy failed. Select the key and copy it yourself.",
};

function renderField() {
	return renderToString(createElement(SecretField, { secret: SECRET, labels }));
}

describe("SecretField", () => {
	it("renders the full secret in a code element that wraps instead of truncating", () => {
		const html = renderField();
		const code = html.match(/<code[^>]*>([^<]*)<\/code>/);
		expect(code?.[1]).toBe(SECRET);
		const codeTag = html.match(/<code[^>]*>/)?.[0] ?? "";
		expect(codeTag).toContain("break-all");
		expect(codeTag).toContain("select-all");
		expect(codeTag).not.toContain("truncate");
	});

	it("uses the passed copy label", () => {
		expect(renderField()).toContain(">Copy key</button>");
	});

	it("shows no failure hint before a copy attempt", () => {
		expect(renderField()).not.toContain(labels.copyFailed);
	});
});

describe("copyToClipboard", () => {
	it("resolves true when the clipboard accepts the text", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		await expect(copyToClipboard(SECRET, { writeText })).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith(SECRET);
	});

	it("resolves false instead of throwing when the clipboard rejects", async () => {
		const writeText = vi
			.fn()
			.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
		await expect(copyToClipboard(SECRET, { writeText })).resolves.toBe(false);
	});

	it("resolves false without a clipboard (insecure origin)", async () => {
		await expect(copyToClipboard(SECRET, undefined)).resolves.toBe(false);
	});
});
