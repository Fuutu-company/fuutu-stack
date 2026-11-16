import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: the dev seed's demo invoices use the plan catalog's
 * `BILLING_CURRENCY` (@fuutu/payments/config). The seed cannot import it
 * (@fuutu/payments depends on @fuutu/db), so the invoice currency has one
 * source — `seedInvoiceCurrency(appSeedConfig)`: the kit default
 * (`seed-context.ts`) or the app's `appSeedConfig.invoiceCurrency`
 * (`app-seed.ts`) — and this keeps it equal to `BILLING_CURRENCY` when a
 * project switches currency.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");

// Non-literal paths: tsc for this package must not follow the Prisma
// client types behind seed-context; vitest resolves them like any import.
const SEED_CONTEXT = join(REPO_ROOT, "packages/db/prisma/seed-context.ts");
const APP_SEED = join(REPO_ROOT, "packages/db/prisma/app-seed.ts");

type SeedConfig = { invoiceCurrency?: string };
const { seedInvoiceCurrency, KIT_SEED_INVOICE_CURRENCY } = (await import(
	/* @vite-ignore */ SEED_CONTEXT
)) as {
	seedInvoiceCurrency: (config: SeedConfig) => string;
	KIT_SEED_INVOICE_CURRENCY: string;
};
const { appSeedConfig } = (await import(/* @vite-ignore */ APP_SEED)) as {
	appSeedConfig: SeedConfig;
};

describe("seed currency guard", () => {
	it("seeded invoices use BILLING_CURRENCY", () => {
		const billing = read("packages/payments/src/config.ts").match(
			/export const BILLING_CURRENCY\s*=\s*"([a-zA-Z]{3})"/,
		)?.[1];
		expect(billing, "BILLING_CURRENCY not found").toBeDefined();
		expect(
			seedInvoiceCurrency(appSeedConfig).toLowerCase(),
			"set appSeedConfig.invoiceCurrency in packages/db/prisma/app-seed.ts to BILLING_CURRENCY",
		).toBe(billing?.toLowerCase());
	});

	it("seed.ts takes every invoice currency from seedInvoiceCurrency(appSeedConfig)", () => {
		const seed = read("packages/db/prisma/seed.ts");
		expect(seed).not.toMatch(/\bcurrency:\s*["'`]/);
		expect(seed).toMatch(
			/const INVOICE_CURRENCY = seedInvoiceCurrency\(appSeedConfig\)/,
		);
		const invoices = seed.slice(seed.indexOf("db.invoice.createMany"));
		expect(invoices.match(/\bcurrency: INVOICE_CURRENCY\b/g)?.length).toBe(4);
	});

	it("defaults to the kit currency, takes the app's, as an upper-case ISO code", () => {
		expect(KIT_SEED_INVOICE_CURRENCY).toBe("USD");
		expect(seedInvoiceCurrency({})).toBe("USD");
		expect(seedInvoiceCurrency({ invoiceCurrency: "eur" })).toBe("EUR");
	});
});
