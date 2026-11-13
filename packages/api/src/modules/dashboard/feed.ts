/**
 * "Happening now" feed — merges real records from several sources into one
 * list. Each mapper copies only display-safe fields: never ip, userAgent,
 * metadata, emails, invoice URLs or API-key hashes/prefixes.
 */

export type DashboardArea = "users" | "billing" | "ai" | "api";

/** Audit actions the kit emits today; anything else is `audit.other`. */
const KNOWN_AUDIT_KINDS = [
	"auth.sign_up",
	"auth.session_created",
	"org.create",
	"org.invite",
	"org.invite.accept",
] as const;

type AuditFeedKind = (typeof KNOWN_AUDIT_KINDS)[number] | "audit.other";

export type FeedKind =
	| AuditFeedKind
	| "invoice.paid"
	| "invoice.open"
	| "api_key.created"
	| "credits.consumed";

export type FeedItem = {
	id: string;
	area: DashboardArea;
	kind: FeedKind;
	actor: string | null;
	/** ISO timestamp. */
	at: string;
	amount?: number;
	currency?: string;
	label?: string;
};

export const FEED_MAX = 8;

const AREA_PREFIXES: Record<DashboardArea, readonly string[]> = {
	users: ["auth", "org", "user", "role"],
	billing: ["payment", "subscription", "invoice"],
	ai: ["credits", "ai", "chat"],
	api: ["api_key", "webhook", "mcp"],
};

export function areaForAuditAction(action: string): DashboardArea {
	const domain = action.split(".")[0] ?? "";
	for (const [area, prefixes] of Object.entries(AREA_PREFIXES)) {
		if (prefixes.includes(domain)) return area as DashboardArea;
	}
	return "users";
}

function auditKind(action: string): AuditFeedKind {
	return KNOWN_AUDIT_KINDS.find((kind) => kind === action) ?? "audit.other";
}

export function auditFeedItem(row: {
	id: string;
	action: string;
	createdAt: Date;
	user: { name: string | null } | null;
}): FeedItem {
	return {
		id: `audit:${row.id}`,
		area: areaForAuditAction(row.action),
		kind: auditKind(row.action),
		actor: row.user?.name ?? null,
		at: row.createdAt.toISOString(),
	};
}

type InvoiceRow = {
	id: string;
	status: string;
	amount: unknown;
	currency: string;
	issuedAt: Date;
	paidAt: Date | null;
};

/** Paid and open invoices only — void/uncollectible are not "activity". */
export function invoiceEventAt(invoice: InvoiceRow): Date | null {
	if (invoice.status === "paid") return invoice.paidAt ?? invoice.issuedAt;
	if (invoice.status === "open") return invoice.issuedAt;
	return null;
}

export function invoiceFeedItem(invoice: InvoiceRow): FeedItem | null {
	const at = invoiceEventAt(invoice);
	if (!at) return null;
	return {
		id: `invoice:${invoice.id}`,
		area: "billing",
		kind: invoice.status === "paid" ? "invoice.paid" : "invoice.open",
		actor: null,
		at: at.toISOString(),
		amount: Number(invoice.amount),
		currency: invoice.currency,
	};
}

export function apiKeyFeedItem(key: {
	id: string;
	name: string;
	createdAt: Date;
}): FeedItem {
	return {
		id: `api_key:${key.id}`,
		area: "api",
		kind: "api_key.created",
		actor: null,
		at: key.createdAt.toISOString(),
		label: key.name,
	};
}

const CONSUMPTION_SOURCES = new Set(["recurring", "topup", "overage"]);

/** Consumption events only — grants, resets and refunds are not usage. */
export function isCreditConsumption(event: {
	amount: number;
	source: string;
}): boolean {
	return event.amount > 0 && CONSUMPTION_SOURCES.has(event.source);
}

export function creditFeedItem(event: {
	id: string;
	amount: number;
	createdAt: Date;
}): FeedItem {
	return {
		id: `credit:${event.id}`,
		area: "ai",
		kind: "credits.consumed",
		actor: null,
		at: event.createdAt.toISOString(),
		amount: event.amount,
	};
}

/** All sources merged, newest first, capped at `FEED_MAX`. */
export function mergeFeed(sources: FeedItem[][]): FeedItem[] {
	return sources
		.flat()
		.sort((a, b) => b.at.localeCompare(a.at))
		.slice(0, FEED_MAX);
}
