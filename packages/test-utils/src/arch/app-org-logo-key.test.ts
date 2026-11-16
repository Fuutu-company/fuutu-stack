import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Org logo storage keys (`apps/saas/.../org-logo-key.ts`) get a random
 * suffix per upload: a predictable key (`<orgId>/<file-name>`) can be
 * guessed through the image proxy or claimed before the real upload.
 */

const KEY_MODULE = join(
	import.meta.dirname,
	"../../../../apps/saas/src/modules/app/organizations/org-logo-key.ts",
);

const { orgLogoKey } = (await import(/* @vite-ignore */ KEY_MODULE)) as {
	orgLogoKey: (fileName: string) => string;
};

describe("orgLogoKey", () => {
	it("keeps the slugged file name and appends a random suffix", () => {
		expect(orgLogoKey("Acme Logo.png")).toMatch(
			/^acme-logo-png-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	it("never repeats a key for the same file", () => {
		expect(orgLogoKey("logo.png")).not.toBe(orgLogoKey("logo.png"));
	});

	it("falls back to 'logo' for a name with no usable characters", () => {
		expect(orgLogoKey("???.")).toMatch(/^logo-[0-9a-f-]{36}$/);
	});
});

describe("orgLogoKey and the profile-input logo rule", () => {
	const RULE_MODULE = join(
		import.meta.dirname,
		"../../../auth/src/hooks/profile-input.ts",
	);

	it.each([
		"Acme Logo.png",
		"???.",
		"Ünïcode näme.JPG",
		"a/b\\c.png",
		"..hidden.png",
	])("builds a URL the owner's rule accepts for %s", async (fileName) => {
		const { isOwnOrganizationLogo } = (await import(
			/* @vite-ignore */ RULE_MODULE
		)) as {
			isOwnOrganizationLogo: (logo: string, organizationId: string) => boolean;
		};
		const url = `/image-proxy/organization-logos/org-1/${orgLogoKey(fileName)}`;
		expect(isOwnOrganizationLogo(url, "org-1")).toBe(true);
		expect(isOwnOrganizationLogo(url, "org-2")).toBe(false);
	});
});
