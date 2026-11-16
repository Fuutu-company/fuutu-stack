import { db } from "../client";

/** Delete Better Auth sessions whose `expiresAt` is before `cutoff`. */
export const deleteSessionsExpiredBefore = (cutoff: Date) =>
	db.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });

/** Delete Better Auth verification rows (tokens, codes) already past `expiresAt` at `now`. */
export const deleteExpiredVerifications = (now: Date) =>
	db.verification.deleteMany({ where: { expiresAt: { lt: now } } });

/** Delete Better Auth rate-limit rows whose last request (epoch ms) is before `cutoff`. */
export const deleteRateLimitsBefore = (cutoff: Date) =>
	db.rateLimit.deleteMany({
		where: { lastRequest: { lt: BigInt(cutoff.getTime()) } },
	});
