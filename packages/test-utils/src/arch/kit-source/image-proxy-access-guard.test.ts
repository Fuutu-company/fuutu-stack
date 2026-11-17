import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `/image-proxy` must authorize every object, not just the session: the
 * route asks `canReadStorageObject` (`@fuutu/api`, unit-tested there)
 * and answers 404 before it streams anything from storage. The behaviour
 * is tested on the route itself in `../image-proxy-access.test.ts`.
 */

const ROUTE = join(
	import.meta.dirname,
	"../../../../../apps/saas/src/app/image-proxy/[...path]/route.ts",
);
const source = readFileSync(ROUTE, "utf8");

describe("image-proxy per-object access guard", () => {
	it("checks canReadStorageObject with the session user", () => {
		expect(source).toMatch(
			/await canReadStorageObject\(\{[^}]*user:\s*session\.user/s,
		);
	});

	it("checks access before streaming the object", () => {
		const check = source.indexOf("canReadStorageObject(");
		const stream = source.indexOf("getObjectStream(bucket");
		expect(check).toBeGreaterThan(-1);
		expect(stream).toBeGreaterThan(check);
	});

	it("answers a denied object with 404 (no existence oracle)", () => {
		expect(source).toMatch(
			/if \(\s*!\(await canReadStorageObject\([\s\S]*?\)\)\s*\)\s*\{?\s*return new Response\("not found", \{ status: 404 \}\)/,
		);
	});
});
