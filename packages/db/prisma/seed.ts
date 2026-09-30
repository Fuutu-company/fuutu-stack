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
 *   - 1 active Purchase (SUBSCRIPTION, provider=creem) for the org
 *   - 3 demo API keys for the admin (org-scoped, user-scoped, expired)
 *   - 4 demo invoices for the acme org (paid + open)
 *   - 2 demo webhooks for the acme org (active + inactive)
 *   - 4 demo notifications for the admin (read/unread, mixed types)
 *
 * Safety: the script only runs when `NODE_ENV !== "production"`. Production
 * seeding is an explicit, ticketed operation — not an auto-run.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import { env } from "@fuutu/env/saas";
import { sha256 } from "@fuutu/utils/hash";
import { db } from "./client";

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

	console.log("Seeding development data…");

	const adminId = randomUUID();
	const memberId = randomUUID();
	const orgId = randomUUID();
	const password = await hashPassword("DevPassword!2345");

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
			createdAt: new Date(),
			members: {
				create: [
					{
						id: randomUUID(),
						userId: adminId,
						role: "owner",
						createdAt: new Date(),
					},
					{
						id: randomUUID(),
						userId: memberId,
						role: "member",
						createdAt: new Date(),
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
				{ userId: admin.id, action: "user.sign_in", ip: "127.0.0.1" },
				{ userId: member.id, action: "user.sign_in", ip: "127.0.0.1" },
				{
					userId: admin.id,
					action: "organization.create",
					metadata: { orgId: acme.id },
				},
				{
					userId: admin.id,
					action: "organization.invite",
					metadata: { orgId: acme.id, email: "member@fuutu.local" },
				},
				{
					userId: member.id,
					action: "organization.accept_invitation",
					metadata: { orgId: acme.id },
				},
			],
		});
	}

	// Sample purchase — pretend the org bought the "pro" plan.
	await db.purchase.upsert({
		where: {
			provider_subscriptionId: {
				provider: "creem",
				subscriptionId: "seed_sub_pro_org",
			},
		},
		update: {},
		create: {
			type: "SUBSCRIPTION",
			status: "ACTIVE",
			provider: "creem",
			priceId: "seed_price_pro",
			productId: "seed_product_pro",
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
				keys.map(async (k) => {
					const plain = makeKey();
					return {
						key: await sha256(plain),
						prefix: `${plain.slice(0, 12)}...`,
						name: k.name,
						userId: admin.id,
						organizationId: k.org,
						expiresAt: k.expires,
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
					currency: "USD",
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
					currency: "USD",
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
					currency: "USD",
					status: "open",
					issuedAt: days(1),
				},
				{
					organizationId: acme.id,
					userId: admin.id,
					providerInvoiceId: "seed_inv_004",
					amount: 49.0,
					currency: "USD",
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
				},
				{
					organizationId: acme.id,
					url: "https://legacy.example.com/fuutu-events",
					secret: randomBytes(32).toString("base64url"),
					events: ["user.created"],
					isActive: false,
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
