/**
 * Prisma surfaces an aborted Serializable transaction (write conflict or
 * deadlock) as P2034. Re-running the whole transaction re-reads fresh
 * state and re-evaluates the in-transaction check — safe because an
 * aborted transaction commits nothing.
 */
export const isSerializationConflict = (err: unknown): boolean =>
	err instanceof Error && "code" in err && err.code === "P2034";

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
