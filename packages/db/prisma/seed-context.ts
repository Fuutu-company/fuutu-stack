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
	/**
	 * The demo purchase: an active Pro subscription (`PAYMENTS_PRO_PRICE_ID`)
	 * for Acme, or for the admin with `organizationsMode: "off"`. Set `false`
	 * when your PLANS have no such plan or your `appSeed` seeds its own
	 * purchases; a re-seed then removes an earlier demo purchase. Default
	 * `true`.
	 */
	demoPurchase?: boolean;
}

/** Demo invoice currency of the kit catalog (`BILLING_CURRENCY = "usd"`). */
export const KIT_SEED_INVOICE_CURRENCY = "USD";

/** The demo invoices' currency: the app's, else the kit's — upper case. */
export function seedInvoiceCurrency(config: AppSeedConfig): string {
	return (config.invoiceCurrency ?? KIT_SEED_INVOICE_CURRENCY).toUpperCase();
}

/** Whether the kit seed writes its demo purchase (`demoPurchase`, default on). */
export function seedsDemoPurchase(config: AppSeedConfig): boolean {
	return config.demoPurchase ?? true;
}

/** Names of the kit seed's demo API keys (all the admin's). */
export const DEMO_API_KEY_NAMES = [
	"Acme CI/CD",
	"Personal CLI",
	"Expired Webhook Listener",
];

export type DemoApiKey = {
	name: string;
	/** Scoped to Acme (else personal). */
	org: boolean;
	/** Expired a week before the seed. */
	expired: boolean;
};

/**
 * The demo API keys — one org-scoped, one personal, one expired. They
 * count against the plan cap of whoever holds them (`LIMITS.<plan>.apiKeys`;
 * a user's personal count includes the org keys they created), which the
 * seed cannot read (@fuutu/payments depends on @fuutu/db). Only the priced
 * demo plan is known to leave room (seed-demo-data-guard checks
 * `LIMITS.<DEMO_PLAN_ID>.apiKeys`), so keys go only where it lies:
 *
 * - `demoPlanOwner: "admin"` (organizations off): all three;
 * - `"acme"`: Acme's key only — the admin's personal plan is unknown;
 * - no demo purchase, or no price for it: none.
 */
export function seedDemoApiKeys(
	config: AppSeedConfig,
	{
		demoPlanPriced,
		demoPlanOwner,
	}: { demoPlanPriced: boolean; demoPlanOwner: "admin" | "acme" },
): DemoApiKey[] {
	if (!seedsDemoPurchase(config) || !demoPlanPriced) return [];
	const [orgKey = "", personalKey = "", expiredKey = ""] = DEMO_API_KEY_NAMES;
	const acme: DemoApiKey = { name: orgKey, org: true, expired: false };
	if (demoPlanOwner === "acme") return [acme];
	return [
		acme,
		{ name: personalKey, org: false, expired: false },
		{ name: expiredKey, org: false, expired: true },
	];
}
