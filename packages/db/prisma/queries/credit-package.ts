import { db } from "../client";
import type { CreditPackage } from "../generated/client";

export const getActiveCreditPackages = (params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
}) =>
	db.creditPackage.findMany({
		where: {
			AND: [
				{
					OR: [
						{ userId: params.userId ?? null },
						{ organizationId: params.organizationId ?? null },
					],
				},
				{ meterKey: params.meterKey },
				{ remaining: { gt: 0 } },
				{
					OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				},
			],
		},
		orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
	});

export type CreateCreditPackageInput = {
	userId?: string | null;
	organizationId?: string | null;
	meterKey: string;
	amount: number;
	expiresAt?: Date | null;
	purchaseId?: string | null;
	priority?: number;
};

export const createCreditPackage = (
	input: CreateCreditPackageInput,
): Promise<CreditPackage> =>
	db.creditPackage.create({
		data: {
			userId: input.userId ?? null,
			organizationId: input.organizationId ?? null,
			meterKey: input.meterKey,
			amount: input.amount,
			remaining: input.amount,
			expiresAt: input.expiresAt ?? null,
			purchaseId: input.purchaseId ?? null,
			priority: input.priority ?? 10,
		},
	});

export const consumeFromCreditPackage = (id: string, amount: number) =>
	db.creditPackage.update({
		where: { id },
		data: {
			consumed: { increment: amount },
			remaining: { decrement: amount },
		},
	});

export const getCreditPackagesForUser = (userId: string) =>
	db.creditPackage.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});

export const getCreditPackagesForOrganization = (organizationId: string) =>
	db.creditPackage.findMany({
		where: { organizationId },
		orderBy: { createdAt: "desc" },
	});
