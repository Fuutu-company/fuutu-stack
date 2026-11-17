import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Uploading or removing the organization logo needs ORGANIZATION.UPDATE
 * (the server answers 403 otherwise). A plain member must get no upload
 * button, no remove button and no file input — the input is `sr-only`, so
 * it stays reachable by keyboard and screen readers when rendered.
 */

const UPLOAD = readFileSync(
	join(
		import.meta.dirname,
		"../../../../apps/saas/src/modules/app/organizations/components/org-logo-upload.tsx",
	),
	"utf8",
);

describe("org logo permission gating", () => {
	it("checks PERMISSIONS.ORGANIZATION.UPDATE with hasOrgPermission", () => {
		expect(UPLOAD).toContain("hasOrgPermission(");
		expect(UPLOAD).toContain("PERMISSIONS.ORGANIZATION.UPDATE");
	});

	it("renders the file input only behind the permission flag", () => {
		const input = UPLOAD.indexOf('type="file"');
		expect(input).toBeGreaterThan(-1);
		const before = UPLOAD.slice(0, input);
		const opening = before.lastIndexOf("<input");
		expect(before.slice(0, opening)).toMatch(/\{canEdit\s*&&\s*\(\s*$/);
	});

	it("refuses an upload or removal without the permission", () => {
		expect(UPLOAD).toMatch(/handleUpload[\s\S]*?if \(!canEdit[^)]*\) return/);
		expect(UPLOAD).toMatch(/handleRemove[\s\S]*?if \(!canEdit[^)]*\) return/);
	});
});
