import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaFrame } from "../components/media-frame/media-frame";
import {
	resolveAutoFilename,
	toDisplayHost,
	toSafeIframeUrl,
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

describe("toSafeIframeUrl", () => {
	it("allows http and https URLs", () => {
		expect(toSafeIframeUrl("https://app.example.com")).toBe(
			"https://app.example.com",
		);
		expect(toSafeIframeUrl("http://localhost:3000/dash")).toBe(
			"http://localhost:3000/dash",
		);
	});

	it("rejects non-http schemes", () => {
		expect(toSafeIframeUrl("javascript:alert(1)")).toBeNull();
		expect(toSafeIframeUrl("data:text/html,<h1>x</h1>")).toBeNull();
		expect(toSafeIframeUrl("file:///etc/passwd")).toBeNull();
		expect(toSafeIframeUrl("vbscript:msgbox(1)")).toBeNull();
	});

	it("rejects unparseable input", () => {
		expect(toSafeIframeUrl("not a url")).toBeNull();
		expect(toSafeIframeUrl("")).toBeNull();
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

describe("MediaFrame expandable", () => {
	it("wraps non-interactive content in a full-area expand button", () => {
		const html = renderToString(
			createElement(MediaFrame, {
				expandable: true,
				expandLabel: "View dashboard",
				imageSrc: "/shots/dash.webp",
				imageAlt: "Dashboard",
			}),
		);
		// full-area trigger: the expand button wraps the frame content
		expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*><div/);
		// no separate corner control
		expect(html).not.toMatch(/aria-expanded="false"[^>]*class="[^"]*absolute/);
	});

	it("uses a corner control for local video instead of wrapping it in a button", () => {
		const html = renderToString(
			createElement(MediaFrame, {
				expandable: true,
				expandLabel: "View demo",
				videoSrc: "/video/demo.mp4",
			}),
		);
		// frame content must not be nested inside a button (invalid HTML +
		// click bubbling would toggle expand when pressing play)
		expect(html).not.toMatch(/<button[^>]*aria-expanded="false"[^>]*><div/);
		expect(html).toMatch(/aria-expanded="false"[^>]*class="[^"]*absolute/);
	});

	it("uses a corner control for iframe content", () => {
		const html = renderToString(
			createElement(MediaFrame, {
				expandable: true,
				expandLabel: "View site",
				iframeSrc: "https://app.example.com",
			}),
		);
		expect(html.indexOf("<iframe")).toBeGreaterThan(-1);
		expect(html.indexOf("<iframe")).toBeLessThan(
			html.indexOf('aria-expanded="false"'),
		);
	});

	it("does not wrap custom children in a button (nested interactive content)", () => {
		const html = renderToString(
			createElement(
				MediaFrame,
				{ expandable: true, expandLabel: "View" },
				createElement("button", { type: "button" }, "inner-action"),
			),
		);
		// the child button renders before the dedicated expand control —
		// i.e. it is not nested inside the expand button
		expect(html.indexOf("inner-action")).toBeLessThan(
			html.indexOf('aria-expanded="false"'),
		);
	});

	it("centers the expanded frame symmetrically and delays z-index collapse", () => {
		const html = renderToString(
			createElement(MediaFrame, {
				expandable: true,
				expandLabel: "View",
				imageSrc: "/a.webp",
			}),
		);
		expect(html).toContain("translate:-50%");
		expect(html).toContain("z-index 0s 0.4s");
	});
});
