import { db, type JsonValue } from "../client";
import type { Prisma } from "../generated/client";

export type AuditLogInput = {
	userId?: string | null;
	organizationId?: string | null;
	action: string;
	ip?: string | null;
	userAgent?: string | null;
	metadata?: JsonValue;
};

export const createAuditLog = (input: AuditLogInput) =>
	db.auditLog.create({ data: input });

export const listAuditLogs = (opts: {
	userId?: string;
	action?: string;
	take?: number;
	skip?: number;
}) => {
	const { userId, action, take = 50, skip = 0 } = opts;
	return db.auditLog.findMany({
		where: {
			...(userId ? { userId } : {}),
			...(action ? { action } : {}),
		},
		orderBy: { createdAt: "desc" },
		take,
		skip,
		include: {
			user: { select: { id: true, email: true, name: true } },
		},
	});
};

export const countAuditLogs = (opts: { userId?: string; action?: string }) =>
	db.auditLog.count({
		where: {
			...(opts.userId ? { userId: opts.userId } : {}),
			...(opts.action ? { action: opts.action } : {}),
		},
	});

/**
 * Find audit logs scoped to an organization.
 * Rows recorded before the `organizationId` column existed carry NULL here —
 * only events written via org-scoped call sites appear.
 */
export const findAuditLogsByOrg = (
	organizationId: string,
	opts: {
		action?: string;
		take?: number;
		skip?: number;
	} = {},
) => {
	const { action, take = 50, skip = 0 } = opts;
	const actionFilter = action
		? action.includes(".")
			? { action }
			: { action: { startsWith: `${action}.` } }
		: undefined;
	return db.auditLog.findMany({
		where: {
			organizationId,
			...(actionFilter ? actionFilter : {}),
		},
		orderBy: { createdAt: "desc" },
		take,
		skip,
		include: {
			user: { select: { id: true, email: true, name: true } },
		},
	});
};

export const deleteAuditLogsBefore = (cutoff: Date) =>
	db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

export type AuditLogSearchScope =
	| { userId: string }
	| { organizationId: string };

/**
 * Full-text search over audit logs.
 * `scope` is required — audit logs must never be searched across tenants.
 */
export const searchAuditLogs = (
	text: string,
	scope: AuditLogSearchScope,
	opts: { action?: string; take?: number; skip?: number } = {},
) => {
	const { action, take = 50, skip = 0 } = opts;

	const actionFilter: Prisma.StringFilter = {
		contains: text,
		mode: "insensitive",
	};
	if (action) {
		// Same convention as findAuditLogsByOrg: a dotted action is an
		// exact match, a bare domain matches as a prefix ("user" → "user.*").
		if (action.includes(".")) {
			actionFilter.equals = action;
		} else {
			actionFilter.startsWith = `${action}.`;
		}
	}

	return db.auditLog.findMany({
		where: {
			action: actionFilter,
			...scope,
		},
		take,
		skip,
		orderBy: { createdAt: "desc" },
	});
};

export const countAuditLogsByOrg = (
	organizationId: string,
	opts: { action?: string } = {},
) => {
	const { action } = opts;
	const actionFilter = action
		? action.includes(".")
			? { action }
			: { action: { startsWith: `${action}.` } }
		: undefined;
	return db.auditLog.count({
		where: {
			organizationId,
			...(actionFilter ? actionFilter : {}),
		},
	});
};
