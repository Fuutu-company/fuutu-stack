/**
 * Development seed script.
 *
 * Creates a minimal but realistic dataset so new contributors can log in and
 * exercise the full SaaS surface without clicking through sign-up flows.
 *
 * Run with: `pnpm db:seed`
 *
 * Users
 *   - admin@fuutu.local  / DevPassword!2345  (role: admin)
 *   - member@fuutu.local / DevPassword!2345  (role: member)
 *
 * Data
 *   - 1 Organization "Acme" with both users as members
 *   - 5 sample AuditLog entries
 *   - 36 demo-activity AuditLog entries over the last 29 days (dashboard chart)
 *   - 1 ai_tokens CreditBalance for the org + 14 usage CreditEvents
 *     (only with PAYMENTS_PRO_PRICE_ID set, i.e. when Acme resolves to Pro;
 *     without it the Pro plan and the demo AI-token balance do not appear.
 *     Databases seeded before this change keep the old balance — reset and
 *     re-seed (prisma migrate reset, then `pnpm db:seed`))
 *   - 1 active Purchase (SUBSCRIPTION, provider=creem) for the org
 *   - 3 demo API keys for the admin (org-scoped, user-scoped, expired)
 *   - 4 demo invoices for the acme org (2 paid, 1 open, 1 void)
 *   - 2 demo webhooks for the acme org (active + inactive)
 *   - 4 demo notifications for the admin (read/unread, mixed types)
 *   - your app's demo data: `prisma/app-seed.ts` runs last
 *
 * Safety: the script refuses `NODE_ENV === "production"` and any non-local
 * `DATABASE_URL` host. Production seeding is an explicit, ticketed operation —
 * not an auto-run.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import { env } from "@fuutu/env/saas";
import { sha256 } from "@fuutu/utils/hash";
import { appSeed, appSeedConfig } from "./app-seed";
import { db } from "./client";
import { seedInvoiceCurrency } from "./seed-context";

// Dashboard demo data. Marked rows (`metadata.seed`) are inserted only while
// none exist, so re-runs stay idempotent and real audit rows never block them.
const DEMO_ACTIVITY_MARKER = "demo-activity";
// The plan Acme is seeded on — seed-demo-data-guard checks its CREDITS and
// price env var against @fuutu/payments/config (skipped once PLANS drop it).
const DEMO_PLAN_ID = "pro";
// = CREDITS.pro.ai_tokens (@fuutu/payments/config) — the seed cannot import
// payments; seed-demo-data-guard keeps the two aligned.
const DEMO_AI_TOKENS_GRANTED = 500_000;
const DAY_MS = 1000 * 60 * 60 * 24;
// = BILLING_CURRENCY (@fuutu/payments/config) — kit default or the app's
// `appSeedConfig.invoiceCurrency`; seed-currency-guard keeps them aligned.
const INVOICE_CURRENCY = seedInvoiceCurrency(appSeedConfig);

// [days ago, minutes before the seed time, actor, kit-emitted action]
const DEMO_AUDIT_ACTIVITY: [number, number, "admin" | "member", string][] = [
	[0, 20, "admin", "auth.session_created"],
	[0, 95, "member", "auth.session_created"],
	[1, 30, "admin", "auth.session_created"],
	[1, 240, "member", "auth.session_created"],
	[2, 60, "admin", "auth.session_created"],
	[3, 45, "admin", "auth.session_created"],
	[3, 300, "member", "auth.session_created"],
	[4, 120, "admin", "org.invite"],
	[4, 90, "member", "org.invite.accept"],
	[5, 15, "admin", "auth.session_created"],
	[6, 200, "member", "auth.session_created"],
	[7, 50, "admin", "auth.session_created"],
	[8, 10, "admin", "auth.session_created"],
	[8, 360, "member", "auth.session_created"],
	[9, 80, "admin", "auth.session_created"],
	[10, 140, "admin", "auth.session_created"],
	[11, 25, "member", "auth.session_created"],
	[12, 70, "admin", "auth.session_created"],
	[13, 180, "admin", "org.invite"],
	[13, 150, "member", "auth.session_created"],
	[14, 40, "admin", "auth.session_created"],
	[15, 260, "member", "auth.session_created"],
	[16, 35, "admin", "auth.session_created"],
	[17, 110, "admin", "auth.session_created"],
	[18, 55, "member", "auth.session_created"],
	[19, 15, "admin", "auth.session_created"],
	[20, 320, "admin", "auth.session_created"],
	[21, 90, "member", "auth.session_created"],
	[22, 45, "admin", "auth.session_created"],
	[23, 130, "admin", "auth.session_created"],
	[24, 75, "member", "auth.session_created"],
	[25, 20, "admin", "auth.session_created"],
	[26, 210, "admin", "auth.session_created"],
	[27, 60, "admin", "org.create"],
	[28, 300, "member", "auth.sign_up"],
	[28, 360, "admin", "auth.sign_up"],
];

// [days ago, minutes before the seed time, tokens consumed]
const DEMO_AI_USAGE: [number, number, number][] = [
	[0, 40, 1_850],
	[1, 120, 3_200],
	[3, 60, 2_400],
	[5, 200, 4_100],
	[7, 30, 1_200],
	[9, 90, 5_600],
	[11, 150, 2_750],
	[13, 45, 3_900],
	[15, 240, 1_650],
	[18, 75, 6_300],
	[20, 20, 2_100],
	[23, 180, 4_450],
	[25, 100, 3_050],
	[28, 60, 2_600],
];

// Password hashing MUST go through `@better-auth/utils/password` — Better-Auth
// uses scrypt with `N=16384, r=16, p=1, dkLen=64` and `password.normalize("NFKC")`.
// Hand-rolled `node:crypto.scryptSync` (default `r=8`) silently produces hashes
// that do not verify, so the seeded users would fail to log in.

async function main() {
	if (env.NODE_ENV === "production") {
		throw new Error(
			"Refusing to seed in production. Set NODE_ENV=development.",
		);
	}

	let seedHost: string;
	try {
		seedHost = new URL(env.DATABASE_URL).hostname;
	} catch {
		throw new Error("Refusing to seed: DATABASE_URL is not a valid URL");
	}
	// WHATWG URL wraps IPv6 literals in brackets — hostname reports "[::1]".
	// "postgres" = the docker-compose / Actions service-container hostname —
	// still a local throwaway DB, just reached over the container network.
	if (
		!["localhost", "127.0.0.1", "::1", "[::1]", "postgres"].includes(seedHost)
	) {
		throw new Error(`Refusing to seed non-local database (${seedHost})`);
	}

	console.log("Seeding development data…");

	const adminId = randomUUID();
	const memberId = randomUUID();
	const orgId = randomUUID();
	const password = await hashPassword("DevPassword!2345");
	// Every seeded list gets distinct `createdAt` values (1 s apart) so list
	// order never depends on insert order or random ids — screenshots and
	// tests see the same sequence on every seed.
	const seedStart = Date.now();
	const at = (n: number) => new Date(seedStart - (100 - n) * 1000);

	await db.user.upsert({
		where: { email: "admin@fuutu.local" },
		update: {},
		create: {
			id: adminId,
			email: "admin@fuutu.local",
			name: "Admin User",
			emailVerified: true,
			role: "admin",
			onboardingComplete: true,
			accounts: {
				create: {
					id: randomUUID(),
					accountId: adminId,
					providerId: "credential",
					password,
				},
			},
		},
	});

	await db.user.upsert({
		where: { email: "member@fuutu.local" },
		update: {},
		create: {
			id: memberId,
			email: "member@fuutu.local",
			name: "Member User",
			emailVerified: true,
			role: "member",
			onboardingComplete: true,
			accounts: {
				create: {
					id: randomUUID(),
					accountId: memberId,
					providerId: "credential",
					password,
				},
			},
		},
	});

	await db.organization.upsert({
		where: { slug: "acme" },
		update: {},
		create: {
			id: orgId,
			name: "Acme",
			slug: "acme",
			createdAt: at(1),
			members: {
				create: [
					{
						id: randomUUID(),
						userId: adminId,
						role: "owner",
						createdAt: at(2),
					},
					{
						id: randomUUID(),
						userId: memberId,
						role: "member",
						createdAt: at(3),
					},
				],
			},
		},
	});

	// Resolve actual DB records (upserts above are keyed by email/slug, so the
	// generated UUIDs only match on first run). Lookups keep re-runs idempotent —
	// every FK reference below must use these resolved ids, never the UUIDs
	// generated at the top of main().
	const admin = await db.user.findUnique({
		where: { email: "admin@fuutu.local" },
		select: { id: true },
	});
	const member = await db.user.findUnique({
		where: { email: "member@fuutu.local" },
		select: { id: true },
	});
	const acme = await db.organization.findUnique({
		where: { slug: "acme" },
		select: { id: true },
	});
	if (!admin || !member || !acme) {
		throw new Error(
			"Seed prerequisites missing: admin/member user or acme org",
		);
	}

	// Sample audit logs.
	const existingLogs = await db.auditLog.count();
	if (existingLogs === 0) {
		await db.auditLog.createMany({
			data: [
				{
					userId: admin.id,
					organizationId: acme.id,
					createdAt: at(11),
					action: "auth.session_created",
					ip: "127.0.0.1",
				},
				{
					userId: member.id,
					organizationId: acme.id,
					createdAt: at(12),
					action: "auth.session_created",
					ip: "127.0.0.1",
				},
				{
					userId: admin.id,
					organizationId: acme.id,
					createdAt: at(13),
					action: "org.create",
				},
				{
					userId: admin.id,
					organizationId: acme.id,
					createdAt: at(14),
					action: "org.invite",
					metadata: { email: "member@fuutu.local" },
				},
				{
					userId: member.id,
					organizationId: acme.id,
					createdAt: at(15),
					action: "org.invite.accept",
				},
			],
		});
	}

	// Dashboard demo activity — guarded by its own marker, not by the total
	// row count, so dev DBs that already have audit rows pick it up too.
	const demoActivity = await db.auditLog.count({
		where: { metadata: { path: ["seed"], equals: DEMO_ACTIVITY_MARKER } },
	});
	if (demoActivity === 0) {
		await db.auditLog.createMany({
			data: DEMO_AUDIT_ACTIVITY.map(([daysAgo, minutes, actor, action]) => ({
				userId: actor === "admin" ? admin.id : member.id,
				organizationId: acme.id,
				action,
				createdAt: new Date(seedStart - daysAgo * DAY_MS - minutes * 60_000),
				metadata: { seed: DEMO_ACTIVITY_MARKER },
			})),
		});
	}

	// Acme's purchase (below) uses the Pro price id the app resolves plans from
	// (`PLANS.pro.priceIdEnvVars.month`). Unset env falls back to a placeholder
	// that the app maps to Free.
	const proPriceId =
		env.PAYMENTS_PRO_PRICE_ID ?? `seed_product_${DEMO_PLAN_ID}`;
	const acmeOnPro = Boolean(env.PAYMENTS_PRO_PRICE_ID);

	// Demo AI usage — the org's ai_tokens balance (pro grant) plus the usage
	// events that consumed it. Only while Acme really is on Pro (a Free org
	// gets no grant), and skipped when the org already has a balance (real
	// usage or an earlier seed), so seeded numbers never overwrite real ones.
	const aiBalance = await db.creditBalance.findFirst({
		where: { organizationId: acme.id, meterKey: "ai_tokens" },
		select: { id: true },
	});
	if (acmeOnPro && !aiBalance) {
		const consumed = DEMO_AI_USAGE.reduce(
			(sum, [, , amount]) => sum + amount,
			0,
		);
		await db.$transaction([
			db.creditBalance.create({
				data: {
					organizationId: acme.id,
					meterKey: "ai_tokens",
					recurringGranted: DEMO_AI_TOKENS_GRANTED,
					recurringConsumed: consumed,
					recurringPeriodEnd: new Date(seedStart + 18 * DAY_MS),
				},
			}),
			db.creditEvent.createMany({
				data: DEMO_AI_USAGE.map(([daysAgo, minutes, amount]) => ({
					organizationId: acme.id,
					meterKey: "ai_tokens",
					amount,
					source: "recurring",
					reason: "ai_chat_message",
					createdAt: new Date(seedStart - daysAgo * DAY_MS - minutes * 60_000),
					metadata: { seed: DEMO_ACTIVITY_MARKER },
				})),
			}),
		]);
	}

	// Sample purchase — pretend the org bought the "pro" plan (see proPriceId).
	await db.purchase.upsert({
		where: {
			provider_subscriptionId: {
				provider: "creem",
				subscriptionId: "seed_sub_pro_org",
			},
		},
		update: { priceId: proPriceId, productId: proPriceId },
		create: {
			type: "SUBSCRIPTION",
			status: "ACTIVE",
			provider: "creem",
			priceId: proPriceId,
			productId: proPriceId,
			subscriptionId: "seed_sub_pro_org",
			customerId: "seed_customer_acme",
			quantity: 2,
			organizationId: acme.id,
		},
	});

	// Demo API keys — one org-scoped, one user-scoped, one expired.
	const existingKeys = await db.apiKey.count({
		where: { userId: admin.id },
	});
	if (existingKeys === 0) {
		const makeKey = () => `futu_sk_${randomBytes(24).toString("base64url")}`;
		const keys = [
			{ name: "Acme CI/CD", org: acme.id, expires: null as Date | null },
			{ name: "Personal CLI", org: null, expires: null as Date | null },
			{
				name: "Expired Webhook Listener",
				org: null,
				expires: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
			},
		];
		await db.apiKey.createMany({
			data: await Promise.all(
				keys.map(async (k, index) => {
					const plain = makeKey();
					return {
						key: await sha256(plain),
						prefix: `${plain.slice(0, 12)}...`,
						name: k.name,
						userId: admin.id,
						organizationId: k.org,
						expiresAt: k.expires,
						createdAt: at(20 + index),
					};
				}),
			),
		});
	}

	// Demo invoices — paid + open statuses for the acme org.
	const existingInvoices = await db.invoice.count({
		where: { organizationId: acme.id },
	});
	if (existingInvoices === 0) {
		const now = Date.now();
		const days = (n: number) => new Date(now - n * 1000 * 60 * 60 * 24);
		await db.invoice.createMany({
			data: [
				{
					organizationId: acme.id,
					userId: admin.id,
					providerInvoiceId: "seed_inv_001",
					url: "https://billing.acme.dev/invoices/001",
					pdfUrl: "https://billing.acme.dev/invoices/001.pdf",
					amount: 49.0,
					currency: INVOICE_CURRENCY,
					status: "paid",
					issuedAt: days(30),
					paidAt: days(29),
				},
				{
					organizationId: acme.id,
					userId: admin.id,
					providerInvoiceId: "seed_inv_002",
					url: "https://billing.acme.dev/invoices/002",
					pdfUrl: "https://billing.acme.dev/invoices/002.pdf",
					amount: 49.0,
					currency: INVOICE_CURRENCY,
					status: "paid",
					issuedAt: days(60),
					paidAt: days(59),
				},
				{
					organizationId: acme.id,
					userId: admin.id,
					providerInvoiceId: "seed_inv_003",
					url: "https://billing.acme.dev/invoices/003",
					amount: 149.0,
					currency: INVOICE_CURRENCY,
					status: "open",
					issuedAt: days(1),
				},
				{
					organizationId: acme.id,
					userId: admin.id,
					providerInvoiceId: "seed_inv_004",
					amount: 49.0,
					currency: INVOICE_CURRENCY,
					status: "void",
					issuedAt: days(45),
				},
			],
		});
	}

	// Demo webhooks — one active, one inactive.
	const existingWebhooks = await db.webhook.count({
		where: { organizationId: acme.id },
	});
	if (existingWebhooks === 0) {
		await db.webhook.createMany({
			data: [
				{
					organizationId: acme.id,
					url: "https://hooks.acme.dev/fuutu-billing",
					secret: randomBytes(32).toString("base64url"),
					events: [
						"subscription.created",
						"subscription.updated",
						"invoice.paid",
					],
					isActive: true,
					createdAt: at(30),
				},
				{
					organizationId: acme.id,
					url: "https://legacy.example.com/fuutu-events",
					secret: randomBytes(32).toString("base64url"),
					events: ["user.created"],
					isActive: false,
					createdAt: at(31),
				},
			],
		});
	}

	// Demo notifications — mix of read/unread and different types.
	const existingNotifications = await db.notification.count({
		where: { userId: admin.id },
	});
	if (existingNotifications === 0) {
		const now = Date.now();
		const mins = (n: number) => new Date(now - n * 1000 * 60);
		await db.notification.createMany({
			data: [
				{
					userId: admin.id,
					type: "billing",
					title: "Invoice paid",
					body: "Invoice seed_inv_002 for $49.00 was paid successfully.",
					data: { invoiceId: "seed_inv_002", amount: 49.0 },
					readAt: mins(120),
					createdAt: mins(180),
				},
				{
					userId: admin.id,
					type: "org",
					title: "New team member",
					body: "Member User accepted the invitation to Acme.",
					data: { orgId: acme.id, email: "member@fuutu.local" },
					readAt: mins(240),
					createdAt: mins(300),
				},
				{
					userId: admin.id,
					type: "system",
					title: "API key expiring soon",
					body: 'The API key "Expired Webhook Listener" expired 7 days ago.',
					data: { keyName: "Expired Webhook Listener" },
					readAt: null,
					createdAt: mins(15),
				},
				{
					userId: admin.id,
					type: "auth",
					title: "New sign-in",
					body: "A new sign-in from 127.0.0.1 was recorded for your account.",
					data: { ip: "127.0.0.1" },
					readAt: null,
					createdAt: mins(5),
				},
			],
		});
	}

	// App demo data (prisma/app-seed.ts) — last, so it can reference the kit rows.
	await appSeed({
		db,
		users: { admin, member },
		orgs: { acme },
		now: seedStart,
	});

	console.log("✓ Seed complete.");
	console.log("  admin@fuutu.local / DevPassword!2345");
	console.log("  member@fuutu.local / DevPassword!2345");
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
