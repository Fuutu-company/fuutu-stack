import { describe, expect, it } from "vitest";
import {
	resolveAutoFilename,
	toDisplayHost,
	toYouTubeEmbed,
} from "../components/media-frame/utils";

describe("toYouTubeEmbed", () => {
	it("converts watch URLs", () => {
		expect(toYouTubeEmbed("https://www.youtube.com/watch?v=abc12345678")).toBe(
			"https://www.youtube.com/embed/abc12345678?autoplay=0&rel=0",
		);
	});

	it("converts youtu.be URLs", () => {
		expect(toYouTubeEmbed("https://youtu.be/abc12345678")).toBe(
			"https://www.youtube.com/embed/abc12345678?autoplay=0&rel=0",
		);
	});

	it("converts existing embed URLs", () => {
		expect(toYouTubeEmbed("https://www.youtube.com/embed/abc12345678")).toBe(
			"https://www.youtube.com/embed/abc12345678?autoplay=0&rel=0",
		);
	});

	it("returns null for non-YouTube URLs", () => {
		expect(toYouTubeEmbed("/videos/demo.mp4")).toBeNull();
		expect(toYouTubeEmbed("https://vimeo.com/12345")).toBeNull();
	});
});

describe("toDisplayHost", () => {
	it("strips protocol and path", () => {
		expect(toDisplayHost("https://app.example.com/dashboard")).toBe(
			"app.example.com",
		);
		expect(toDisplayHost("http://localhost:3000")).toBe("localhost:3000");
	});
});

describe("resolveAutoFilename", () => {
	it("prefers an explicit filename", () => {
		expect(
			resolveAutoFilename({
				filename: "demo.tsx",
				imageSrc: "/shots/a.webp",
				videoSrc: "/v.mp4",
			}),
		).toBe("demo.tsx");
	});

	it("falls back to the image basename", () => {
		expect(
			resolveAutoFilename({ imageSrc: "/screenshots/dashboard.webp" }),
		).toBe("dashboard.webp");
	});

	it("uses a generic name for video sources", () => {
		expect(resolveAutoFilename({ videoSrc: "/videos/demo.mp4" })).toBe(
			"video.embed",
		);
	});

	it("derives a host from iframe sources", () => {
		expect(
			resolveAutoFilename({ iframeSrc: "https://app.example.com/dash" }),
		).toBe("app.example.com");
	});

	it("falls back to the default app name", () => {
		expect(resolveAutoFilename({})).toBe("app.localhost");
	});
});
