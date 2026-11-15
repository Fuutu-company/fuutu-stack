import { db } from "../client";

/**
 * Round trip to the database for the system status page. Never throws:
 * an unreachable database is the answer, and the driver error (host,
 * credentials) stays out of the result.
 */
export async function pingDatabase(): Promise<{
	ok: boolean;
	latencyMs: number;
}> {
	const start = performance.now();
	try {
		await db.$queryRaw`SELECT 1`;
		return { ok: true, latencyMs: Math.round(performance.now() - start) };
	} catch {
		return { ok: false, latencyMs: Math.round(performance.now() - start) };
	}
}
