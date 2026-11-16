import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { ConsentPrivacyLink } from "../consent";

describe("ConsentPrivacyLink", () => {
	it("renders nothing without a URL", () => {
		expect(
			ConsentPrivacyLink({ href: undefined, label: "Privacy" }),
		).toBeNull();
	});

	it("renders a link to the configured privacy page", () => {
		const el = ConsentPrivacyLink({
			href: "https://site.test/legal/privacy",
			label: "Privacy Policy",
		});
		expect(isValidElement(el)).toBe(true);
		const props = (
			el as { type: string; props: { href: string; children: string } }
		).props;
		expect((el as { type: string }).type).toBe("a");
		expect(props.href).toBe("https://site.test/legal/privacy");
		expect(props.children).toBe("Privacy Policy");
	});
});
