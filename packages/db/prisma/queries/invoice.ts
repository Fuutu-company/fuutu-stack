import { db } from "../client";

export type InvoiceInput = {
	organizationId?: string | null;
	userId: string;
	providerInvoiceId?: string | null;
	url?: string | null;
	pdfUrl?: string | null;
	amount: string;
	currency?: string;
	status: string;
	issuedAt: Date;
	paidAt?: Date | null;
};

export const createInvoice = (data: InvoiceInput) =>
	db.invoice.create({ data });

/**
 * internal — webhook callbacks only.
 * Upsert keyed on `providerInvoiceId` (callers store `<provider>:<id>` to
 * keep the key unique across providers). A redelivered invoice event
 * refreshes status/URLs instead of creating a second row. There is no DB
 * unique constraint on providerInvoiceId — the lookup is a read-then-write
 * and relies on sequential webhook processing, same as the rest of the
 * sync layer's dedup lookups.
 */
export const upsertInvoiceByProviderId = async (data: InvoiceInput) => {
	if (!data.providerInvoiceId) return createInvoice(data);
	const existing = await db.invoice.findFirst({
		where: { providerInvoiceId: data.providerInvoiceId },
	});
	if (!existing) return createInvoice(data);
	return db.invoice.update({
		where: { id: existing.id },
		data: {
			status: data.status,
			amount: data.amount,
			...(data.url !== undefined && { url: data.url }),
			...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl }),
			...(data.currency && { currency: data.currency }),
			...(data.paidAt ? { paidAt: data.paidAt } : {}),
		},
	});
};

export const listInvoicesByOrg = (
	organizationId: string,
	opts: { take?: number; skip?: number; status?: string } = {},
) => {
	const { take = 50, skip = 0, status } = opts;
	return db.invoice.findMany({
		where: { organizationId, ...(status ? { status } : {}) },
		orderBy: { issuedAt: "desc" },
		take,
		skip,
	});
};

export const listInvoicesByUser = (
	userId: string,
	opts: { take?: number; skip?: number; status?: string } = {},
) => {
	const { take = 50, skip = 0, status } = opts;
	return db.invoice.findMany({
		where: { userId, ...(status ? { status } : {}) },
		orderBy: { issuedAt: "desc" },
		take,
		skip,
	});
};

export const getInvoiceById = (
	id: string,
	scope: { organizationId?: string; userId?: string },
) => {
	if (scope.organizationId) {
		return db.invoice.findFirst({
			where: { id, organizationId: scope.organizationId },
		});
	}
	if (scope.userId) {
		return db.invoice.findFirst({
			where: { id, userId: scope.userId },
		});
	}
	throw new Error(
		"getInvoiceById requires either organizationId or userId in scope",
	);
};

/**
 * internal — webhook callbacks only.
 * Updates an invoice by internal `id` without an ownership scope because
 * webhook callbacks authenticate via HMAC signature, not a user session.
 */
export const updateInvoiceStatus = (
	id: string,
	status: string,
	paidAt?: Date | null,
) =>
	db.invoice.update({
		where: { id },
		data: { status, ...(paidAt ? { paidAt } : {}) },
	});

export const countInvoicesByOrg = (organizationId: string) =>
	db.invoice.count({ where: { organizationId } });

export const countInvoicesByUser = (userId: string) =>
	db.invoice.count({ where: { userId } });
