/**
 * Prisma unique-violation error code. Shared by query modules that
 * recover from find-then-create races against unique indexes.
 */
export const isUniqueViolation = (err: unknown): boolean =>
	err instanceof Error && "code" in err && err.code === "P2002";

/**
 * Prisma surfaces an aborted Serializable transaction (write conflict or
 * deadlock) as P2034. Driver adapters (@prisma/adapter-pg) instead throw a
 * `DriverAdapterError` whose `cause.kind` is `"TransactionWriteConflict"`
 * (SQLSTATE 40001/40P01) — both shapes must be recognized or retries never
 * fire. Re-running the whole transaction re-reads fresh state and
 * re-evaluates the in-transaction check — safe because an aborted
 * transaction commits nothing.
 */
export const isSerializationConflict = (err: unknown): boolean => {
	if (err instanceof Error && "code" in err && err.code === "P2034") {
		return true;
	}
	return (
		err instanceof Error &&
		typeof err.cause === "object" &&
		err.cause !== null &&
		"kind" in err.cause &&
		err.cause.kind === "TransactionWriteConflict"
	);
};

/**
 * Retry a Serializable transaction on P2034 (max 3 attempts).
 * Precedent: `withUniqueViolationRetry` in queries/credit-balance.ts.
 */
export const withSerializationRetry = async <T>(
	fn: () => Promise<T>,
): Promise<T> => {
	const maxAttempts = 3;
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (!isSerializationConflict(err) || attempt >= maxAttempts) throw err;
		}
	}
};
