import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Webhook create / update / delete need the org admin tier (`ORG_POLICY`);
 * plain members only view. The list UI must gate each control with the same
 * `hasOrgPermission` check the other org settings use, instead of showing
 * controls the server answers with 403.
 */

const LIST = readFileSync(
	join(
		import.meta.dirname,
		"../../../../apps/saas/src/modules/app/webhooks/components/webhook-list.tsx",
	),
	"utf8",
);

describe("webhook list permission gating", () => {
	it.each(["WEBHOOK.CREATE", "WEBHOOK.UPDATE", "WEBHOOK.DELETE"])(
		"checks PERMISSIONS.%s with hasOrgPermission",
		(permission) => {
			expect(LIST).toContain("hasOrgPermission(");
			expect(LIST).toContain(`PERMISSIONS.${permission}`);
		},
	);

	it("resolves the role through useOrgRole", () => {
		expect(LIST).toContain("useOrgRole(slug)");
	});

	it("renders each control only behind its permission flag", () => {
		expect(LIST).toMatch(/canCreate\s*&&/);
		expect(LIST).toMatch(/canUpdate\s*&&/);
		expect(LIST).toMatch(/canDelete\s*&&/);
	});
});
