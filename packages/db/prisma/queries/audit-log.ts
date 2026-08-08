import { db } from "../client";
import type { Prisma } from "../generated/client";

export type AuditLogInput = {
	userId?: string | null;
	action: string;
	ip?: string | null;
	userAgent?: string | null;
	metadata?: Prisma.InputJsonValue;
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
 * Find audit logs scoped to an organization by filtering on its members' user IDs.
 * The AuditLog table has no `organizationId` column, so we resolve org members
 * first and filter by their user IDs.
 */
export const findAuditLogsByOrg = async (
	organizationId: string,
	opts: {
		action?: string;
		take?: number;
		skip?: number;
	} = {},
) => {
	const { action, take = 50, skip = 0 } = opts;
	const members = await db.member.findMany({
		where: { organizationId },
		select: { userId: true },
	});
	const userIds = members.map((m) => m.userId);
	if (userIds.length === 0) return [];

	const actionFilter = action
		? action.includes(".")
			? { action }
			: { action: { startsWith: `${action}.` } }
		: undefined;
	return db.auditLog.findMany({
		where: {
			userId: { in: userIds },
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

export const searchAuditLogs = (
	text: string,
	opts: { take?: number; skip?: number } = {},
) => {
	const { take = 50, skip = 0 } = opts;
	return db.auditLog.findMany({
		where: { action: { contains: text } },
		take,
		skip,
		orderBy: { createdAt: "desc" },
	});
};

export const countAuditLogsByOrg = async (
	organizationId: string,
	opts: { action?: string } = {},
) => {
	const { action } = opts;
	const members = await db.member.findMany({
		where: { organizationId },
		select: { userId: true },
	});
	const userIds = members.map((m) => m.userId);
	if (userIds.length === 0) return 0;

	const actionFilter = action
		? action.includes(".")
			? { action }
			: { action: { startsWith: `${action}.` } }
		: undefined;
	return db.auditLog.count({
		where: {
			userId: { in: userIds },
			...(actionFilter ? actionFilter : {}),
		},
	});
};
