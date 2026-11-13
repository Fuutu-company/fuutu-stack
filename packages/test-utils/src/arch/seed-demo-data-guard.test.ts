import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: the dev seed's dashboard demo data (packages/db/prisma/seed.ts).
 *
 * - The Acme `ai_tokens` grant mirrors `CREDITS.pro.ai_tokens`
 *   (@fuutu/payments/config). The seed cannot import it (@fuutu/payments
 *   depends on @fuutu/db), so this keeps the copies aligned. The grant and
 *   its usage events are seeded only when Acme resolves to the Pro price.
 * - Demo activity rows carry a seed marker and are only inserted while no
 *   marked row exists, so `pnpm db:seed` stays idempotent.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");
const toNumber = (raw: string | undefined) =>
	raw === undefined ? undefined : Number(raw.replaceAll("_", ""));

const seed = read("packages/db/prisma/seed.ts");

describe("seed demo data guard", () => {
	it("seeded ai_tokens grant equals CREDITS.pro.ai_tokens", () => {
		const credits = read("packages/payments/src/config.ts").match(
			/export const CREDITS[^=]*=\s*\{[\s\S]*?\bpro:\s*\{[^}]*?\bai_tokens:\s*([\d_]+)/,
		)?.[1];
		expect(credits, "CREDITS.pro.ai_tokens not found").toBeDefined();

		const granted = seed.match(
			/const DEMO_AI_TOKENS_GRANTED\s*=\s*([\d_]+)/,
		)?.[1];
		expect(granted, "DEMO_AI_TOKENS_GRANTED not found in seed").toBeDefined();
		expect(toNumber(granted)).toBe(toNumber(credits));
		expect(seed).toMatch(/recurringGranted:\s*DEMO_AI_TOKENS_GRANTED/);
	});

	it("Acme's seeded purchase uses the Pro price id the app resolves plans from", () => {
		const envVar = read("packages/payments/src/config.ts").match(
			/\bpro:\s*\{[\s\S]*?priceIdEnvVars:\s*\{\s*month:\s*"(\w+)"/,
		)?.[1];
		expect(envVar, "PLANS.pro.priceIdEnvVars.month not found").toBeDefined();

		expect(seed).toContain(`env.${envVar}`);
		const purchase = seed.slice(seed.indexOf("db.purchase.upsert"));
		const purchaseBlock = purchase.slice(0, purchase.indexOf("});\n"));
		// No literal product/price ids inside the purchase: a hard-coded id
		// never matches the configured price and leaves Acme on Free.
		expect(purchaseBlock).not.toMatch(/(?:priceId|productId):\s*"/);
		expect(purchaseBlock).toMatch(/update:\s*\{[^}]*productId/);
	});

	it("grants the Pro ai_tokens demo only when Acme resolves to the Pro price", () => {
		const envVar = read("packages/payments/src/config.ts").match(
			/\bpro:\s*\{[\s\S]*?priceIdEnvVars:\s*\{\s*month:\s*"(\w+)"/,
		)?.[1];
		expect(envVar, "PLANS.pro.priceIdEnvVars.month not found").toBeDefined();

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
		// Pro flag gates the grant; the existing-balance check keeps re-runs
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
});
