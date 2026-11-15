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

/**
 * Audit-log filters. `userId`, `organizationId` and `action` match the
 * columns exactly. Support actions (`admin.*`) store the acting admin in
 * `userId` and their targets in `metadata.targetUserId` /
 * `metadata.targetOrganizationId`.
 */
export type AuditLogFilters = {
	userId?: string;
	/** The user who performed the action (the `userId` column). */
	actorUserId?: string;
	organizationId?: string;
	action?: string;
	/** Raw prefix match on `action`, e.g. `"admin."`. */
	actionPrefix?: string;
	targetUserId?: string;
	targetOrganizationId?: string;
	/** Rows by the user plus rows targeting the user. */
	timelineUserId?: string;
	/** Rows of the organization plus support actions targeting it. */
	timelineOrganizationId?: string;
	from?: Date;
	to?: Date;
};

const metadataEquals = (
	key: "targetUserId" | "targetOrganizationId",
	value: string,
): Prisma.AuditLogWhereInput => ({
	metadata: { path: [key], equals: value },
});

const auditLogWhere = (filters: AuditLogFilters): Prisma.AuditLogWhereInput => {
	const where: Prisma.AuditLogWhereInput = {
		...(filters.userId ? { userId: filters.userId } : {}),
		...(filters.organizationId
			? { organizationId: filters.organizationId }
			: {}),
		...(filters.action ? { action: filters.action } : {}),
	};
	const and: Prisma.AuditLogWhereInput[] = [];
	if (filters.actorUserId) and.push({ userId: filters.actorUserId });
	if (filters.actionPrefix) {
		and.push({ action: { startsWith: filters.actionPrefix } });
	}
	if (filters.targetUserId) {
		and.push(metadataEquals("targetUserId", filters.targetUserId));
	}
	if (filters.targetOrganizationId) {
		and.push(
			metadataEquals("targetOrganizationId", filters.targetOrganizationId),
		);
	}
	if (filters.timelineUserId) {
		and.push({
			OR: [
				{ userId: filters.timelineUserId },
				metadataEquals("targetUserId", filters.timelineUserId),
			],
		});
	}
	if (filters.timelineOrganizationId) {
		and.push({
			OR: [
				{ organizationId: filters.timelineOrganizationId },
				metadataEquals("targetOrganizationId", filters.timelineOrganizationId),
			],
		});
	}
	if (filters.from || filters.to) {
		and.push({
			createdAt: {
				...(filters.from ? { gte: filters.from } : {}),
				...(filters.to ? { lte: filters.to } : {}),
			},
		});
	}
	return and.length > 0 ? { ...where, AND: and } : where;
};

export const listAuditLogs = (
	opts: AuditLogFilters & { take?: number; skip?: number },
) => {
	const { take = 50, skip = 0, ...filters } = opts;
	return db.auditLog.findMany({
		where: auditLogWhere(filters),
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		take,
		skip,
		include: {
			user: { select: { id: true, email: true, name: true } },
		},
	});
};

export const countAuditLogs = (opts: AuditLogFilters) =>
	db.auditLog.count({ where: auditLogWhere(opts) });

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
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		take,
		skip,
		include: {
			user: { select: { id: true, email: true, name: true } },
		},
	});
};

/**
 * Owner scope for `listAuditLogDates`: a user (personal — all of the user's
 * rows), an organization (all rows of that org), or a user inside one
 * organization (that member's own rows in that org only).
 */
export type AuditLogDatesScope =
	| { userId: string; organizationId?: never }
	| { organizationId: string; userId?: string };

/**
 * Action + timestamp of every audit row since `since`, for activity charts.
 * An owner is required — the series must never span tenants.
 */
export const listAuditLogDates = (
	opts: AuditLogDatesScope & { since: Date; take?: number },
) => {
	const { organizationId, userId, since, take = 5000 } = opts;
	if (!organizationId && !userId) {
		throw new Error("listAuditLogDates requires userId or organizationId");
	}
	return db.auditLog.findMany({
		where: {
			...(organizationId ? { organizationId } : {}),
			...(userId ? { userId } : {}),
			createdAt: { gte: since },
		},
		select: { action: true, createdAt: true },
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		take,
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
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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
