import { db } from "../client";
import type { Prisma } from "../generated/client";

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
 * Updates an invoice by provider ID without an ownership scope because
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

export type InvoiceWhereInput = Prisma.InvoiceWhereInput;
