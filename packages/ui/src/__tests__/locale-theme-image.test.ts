import { describe, expect, it } from "vitest";
import { buildImageCandidates } from "../hooks/use-locale-theme-image";

describe("buildImageCandidates", () => {
	it("orders candidates most-specific to least-specific", () => {
		expect(buildImageCandidates("/shots/dash", "webp", "de", "dark")).toEqual([
			"/shots/dash.de.dark.webp",
			"/shots/dash.de.webp",
			"/shots/dash.en.dark.webp",
			"/shots/dash.en.webp",
			"/shots/dash.webp",
		]);
	});

	it("deduplicates candidates for the default locale", () => {
		expect(buildImageCandidates("/shots/dash", "png", "en", "light")).toEqual([
			"/shots/dash.en.light.png",
			"/shots/dash.en.png",
			"/shots/dash.png",
		]);
	});
});
