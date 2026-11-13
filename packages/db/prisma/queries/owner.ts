/**
 * Polymorphic owner invariant for `purchase`, `credit_balance` and
 * `credit_package`: exactly one of userId / organizationId is set. Prisma
 * has no CHECK constraints, so every write path in these query functions
 * calls this first — the raw client is never used outside packages/db
 * (db-access architecture guard).
 */
export function assertSingleOwner(owner: {
	userId?: string | null;
	organizationId?: string | null;
}): void {
	if (Boolean(owner.userId) === Boolean(owner.organizationId)) {
		throw new Error(
			"owner invariant: exactly one of userId / organizationId must be set",
		);
	}
}
