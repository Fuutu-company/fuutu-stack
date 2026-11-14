import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: the dev seed's dashboard demo data (packages/db/prisma/seed.ts).
 *
 * - The seed puts Acme on `DEMO_PLAN_ID` (declared in seed.ts). The Acme
 *   `ai_tokens` grant mirrors `CREDITS.<DEMO_PLAN_ID>.ai_tokens`
 *   (@fuutu/payments/config). The seed cannot import it (@fuutu/payments
 *   depends on @fuutu/db), so this keeps the copies aligned. The grant and
 *   its usage events are seeded only when Acme resolves to that plan's
 *   price. An app whose PLANS drop the demo plan skips these checks.
 * - Demo activity rows carry a seed marker and are only inserted while no
 *   marked row exists, so `pnpm db:seed` stays idempotent.
 * - The app seed hook (`prisma/app-seed.ts`) runs once, after the kit data.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");
const toNumber = (raw: string | undefined) =>
	raw === undefined ? undefined : Number(raw.replaceAll("_", ""));

const seed = read("packages/db/prisma/seed.ts");
const payments = read("packages/payments/src/config.ts");

const DEMO_PLAN_ID =
	seed.match(/const DEMO_PLAN_ID\s*=\s*"(\w+)"/)?.[1] ?? "<missing>";
const PLANS_START = "export const PLANS = {";
const PLANS_END = "} as const satisfies Record<PlanId, Plan>";
const markersFound =
	payments.includes(PLANS_START) && payments.includes(PLANS_END);
const plansBlock = payments.slice(
	payments.indexOf(PLANS_START),
	payments.indexOf(PLANS_END),
);
const demoPlanInCatalog = new RegExp(`^\\t${DEMO_PLAN_ID}:\\s*\\{`, "m").test(
	plansBlock,
);

/** `PLANS.<DEMO_PLAN_ID>.priceIdEnvVars.month` from the payments config. */
function demoPlanEnvVar(): string | undefined {
	const at = plansBlock.search(new RegExp(`^\\t${DEMO_PLAN_ID}:\\s*\\{`, "m"));
	const plan = plansBlock.slice(at, plansBlock.indexOf("\n\t},", at));
	return plan.match(/priceIdEnvVars:\s*\{\s*month:\s*"(\w+)"/)?.[1];
}

describe("seed demo data guard", () => {
	it("finds the PLANS block in the payments config", () => {
		expect(markersFound, `"${PLANS_START}" / "${PLANS_END}" in config.ts`).toBe(
			true,
		);
		expect(plansBlock.trim().length).toBeGreaterThan(0);
	});

	it("declares the plan Acme is seeded on", () => {
		expect(DEMO_PLAN_ID, 'const DEMO_PLAN_ID = "<id>" in seed.ts').not.toBe(
			"<missing>",
		);
	});

	describe.skipIf(!demoPlanInCatalog)("demo plan in PLANS", () => {
		it("seeded ai_tokens grant equals CREDITS.<demo plan>.ai_tokens", () => {
			const credits = payments.match(
				new RegExp(
					`export const CREDITS[^=]*=\\s*\\{[\\s\\S]*?\\b${DEMO_PLAN_ID}:\\s*\\{[^}]*?\\bai_tokens:\\s*([\\d_]+)`,
				),
			)?.[1];
			expect(
				credits,
				`CREDITS.${DEMO_PLAN_ID}.ai_tokens not found`,
			).toBeDefined();

			const granted = seed.match(
				/const DEMO_AI_TOKENS_GRANTED\s*=\s*([\d_]+)/,
			)?.[1];
			expect(granted, "DEMO_AI_TOKENS_GRANTED not found in seed").toBeDefined();
			expect(toNumber(granted)).toBe(toNumber(credits));
			expect(seed).toMatch(/recurringGranted:\s*DEMO_AI_TOKENS_GRANTED/);
		});

		it("Acme's seeded purchase uses the demo plan's price id the app resolves plans from", () => {
			const envVar = demoPlanEnvVar();
			expect(
				envVar,
				`PLANS.${DEMO_PLAN_ID}.priceIdEnvVars.month not found`,
			).toBeDefined();

			expect(seed).toContain(`env.${envVar}`);
			const purchase = seed.slice(seed.indexOf("db.purchase.upsert"));
			const purchaseBlock = purchase.slice(0, purchase.indexOf("});\n"));
			// No literal product/price ids inside the purchase: a hard-coded id
			// never matches the configured price and leaves Acme on Free.
			expect(purchaseBlock).not.toMatch(/(?:priceId|productId):\s*"/);
			expect(purchaseBlock).toMatch(/update:\s*\{[^}]*productId/);
		});

		it("grants the demo ai_tokens only when Acme resolves to the demo plan's price", () => {
			const envVar = demoPlanEnvVar();
			expect(
				envVar,
				`PLANS.${DEMO_PLAN_ID}.priceIdEnvVars.month not found`,
			).toBeDefined();

			// Without the env var the purchase falls back to a placeholder id the
			// app maps to Free — a 500k Pro grant would contradict the plan.
			const flag = seed.match(
				new RegExp(`const (\\w+)\\s*=\\s*Boolean\\(env\\.${envVar}\\)`),
			)?.[1];
			expect(
				flag,
				`const <flag> = Boolean(env.${envVar}) not found`,
			).toBeDefined();

			const grantAt = seed.indexOf("db.creditBalance.create(");
			expect(grantAt, "db.creditBalance.create not found").toBeGreaterThan(-1);
			const before = seed.slice(0, grantAt);
			const guard = before.slice(before.lastIndexOf("if ("));
			const condition = /^if \(([^)]*)\)\s*\{/.exec(guard)?.[1] ?? "";
			// Plan flag gates the grant; the existing-balance check keeps re-runs
			// idempotent; usage events sit in the same block.
			expect(condition).toMatch(new RegExp(`\\b${flag}\\b`));
			expect(condition).toMatch(/!\s*aiBalance\b/);
			expect(guard, "the guarded block closes before the grant").not.toContain(
				"\n\t}\n",
			);
			const block = seed.slice(
				before.lastIndexOf("if ("),
				seed.indexOf("\n\t}\n", grantAt),
			);
			expect(block).toMatch(/db\.creditEvent\.createMany/);
			expect(seed.match(/db\.creditBalance\.create\(/g)).toHaveLength(1);
			expect(seed.match(/db\.creditEvent\.createMany/g)).toHaveLength(1);
		});
	});

	it("demo activity rows are guarded by the seed marker", () => {
		expect(seed).toMatch(/const DEMO_ACTIVITY_MARKER\s*=\s*"demo-activity"/);

		// Audit rows: count marked rows first, insert only when none exist,
		// and every inserted row carries the marker.
		const auditGuard = seed.match(
			/const (\w+)\s*=\s*await db\.auditLog\.count\(\{\s*where:\s*\{\s*metadata:\s*\{\s*path:\s*\["seed"\],\s*equals:\s*DEMO_ACTIVITY_MARKER/,
		);
		expect(auditGuard, "marked audit-log count not found").not.toBeNull();
		const guardVar = auditGuard?.[1] ?? "";
		const guardAt = seed.indexOf(`if (${guardVar} === 0)`);
		expect(guardAt, `if (${guardVar} === 0) not found`).toBeGreaterThan(-1);
		const demoBlock = seed.slice(guardAt, seed.indexOf("\n\t}\n", guardAt));
		expect(demoBlock).toMatch(/db\.auditLog\.createMany/);
		expect(demoBlock).toMatch(
			/metadata:\s*\{\s*seed:\s*DEMO_ACTIVITY_MARKER\s*\}/,
		);

		// Credit events: marked too, so a reseed can tell demo usage apart.
		expect(seed).toMatch(
			/db\.creditEvent\.createMany[\s\S]*?metadata:\s*\{\s*seed:\s*DEMO_ACTIVITY_MARKER\s*\}/,
		);
	});

	it("runs the app seed hook once, after the kit data, with the seeded records", () => {
		const calls = seed.match(/await appSeed\(/g) ?? [];
		expect(calls).toHaveLength(1);
		const call = seed.indexOf("await appSeed(");
		expect(call).toBeGreaterThan(
			seed.lastIndexOf("db.notification.createMany"),
		);
		expect(call).toBeLessThan(seed.indexOf("Seed complete"));
		expect(seed.slice(call)).toMatch(
			/^await appSeed\(\{\s*db,\s*users: \{ admin, member \},\s*orgs: \{ acme \},\s*now: seedStart,?\s*\}\)/,
		);
	});
});
