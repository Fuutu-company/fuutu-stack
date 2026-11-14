import type { db } from "./client";

/**
 * What the dev seed (`seed.ts`) hands the app seed hook (`app-seed.ts`)
 * once the kit demo data exists.
 */
export interface AppSeedContext {
	/** The Prisma client the kit seed writes with. */
	db: typeof db;
	/** Seeded users (`admin@fuutu.local`, `member@fuutu.local`). */
	users: { admin: { id: string }; member: { id: string } };
	/** Seeded organizations (slug `acme`, both users are members). */
	orgs: { acme: { id: string } };
	/** Seed start time in ms — base for deterministic `createdAt` values. */
	now: number;
}

/**
 * Seed options an app sets in `app-seed.ts` (`appSeedConfig`) — read by
 * the kit seed. Every field is optional; unset fields keep the kit data.
 */
export interface AppSeedConfig {
	/**
	 * ISO 4217 code of the demo invoices — must equal `BILLING_CURRENCY`
	 * (@fuutu/payments/config; the seed cannot import it), checked by
	 * `seed-currency-guard`. Default `KIT_SEED_INVOICE_CURRENCY`.
	 */
	invoiceCurrency?: string;
}

/** Demo invoice currency of the kit catalog (`BILLING_CURRENCY = "usd"`). */
export const KIT_SEED_INVOICE_CURRENCY = "USD";

/** The demo invoices' currency: the app's, else the kit's — upper case. */
export function seedInvoiceCurrency(config: AppSeedConfig): string {
	return (config.invoiceCurrency ?? KIT_SEED_INVOICE_CURRENCY).toUpperCase();
}
