import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthCard } from "../components/auth-card";

describe("AuthCard", () => {
	it("titles the auth screen with an h1 by default", () => {
		const html = renderToString(
			createElement(AuthCard, { title: "Welcome back", children: "form" }),
		);
		expect(html).toMatch(/<h1[^>]*>Welcome back<\/h1>/);
	});

	it("renders a lower heading level when embedded in a page that owns the h1", () => {
		const html = renderToString(
			createElement(AuthCard, {
				title: "Welcome back",
				titleAs: "h4",
				children: "form",
			}),
		);
		expect(html).not.toContain("<h1");
		expect(html).toMatch(/<h4[^>]*>Welcome back<\/h4>/);
	});
});
