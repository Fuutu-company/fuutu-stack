import { isBanActive } from "@fuutu/auth/types";
import { getUserAccessState } from "@fuutu/db";
import { toSystemRole } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const adminIdSchema = z.string().min(1).max(64);

/** Why support takes a sensitive action — stored in the audit log. */
export const reasonSchema = z.string().trim().min(3).max(500);

/** JSON booleans (RPC) and `"true"`/`"false"` query strings (OpenAPI GET). */
export const queryBooleanSchema = z.union([
	z.boolean(),
	z.enum(["true", "false"]).transform((value) => value === "true"),
]);

export const pageSchema = z.coerce.number().int().min(1).default(1);

export type AdminTargetUser = {
	id: string;
	email: string;
	isAdmin: boolean;
	isBanned: boolean;
};

/** The user an admin acts on, read fresh from the database. */
export async function loadTargetUser(userId: string): Promise<AdminTargetUser> {
	const target = await getUserAccessState(userId);
	if (!target) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}
	return {
		id: target.id,
		email: target.email,
		isAdmin: toSystemRole(target.role) === "admin",
		isBanned: isBanActive(target),
	};
}

/** Support actions an admin must never take on their own account. */
export function assertNotSelf(
	actorId: string,
	targetId: string,
	message: string,
): void {
	if (actorId === targetId) {
		throw new ORPCError("FORBIDDEN", { message });
	}
}

/** Peer protection: an admin is demoted first, then acted on. */
export function assertNotAdmin(target: AdminTargetUser, message: string): void {
	if (target.isAdmin) {
		throw new ORPCError("FORBIDDEN", { message });
	}
}

const AUTH_ERROR_CODES = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	429: "TOO_MANY_REQUESTS",
} as const;

function isAuthErrorStatus(
	status: number,
): status is keyof typeof AUTH_ERROR_CODES {
	return status in AUTH_ERROR_CODES;
}

/**
 * Runs a Better Auth server call and maps its client errors (`APIError`
 * 4xx) to typed oRPC errors — unmapped they would flatten to a 500.
 */
export async function withAuthErrors<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (err) {
		if (
			err instanceof Error &&
			err.name === "APIError" &&
			"statusCode" in err &&
			typeof err.statusCode === "number" &&
			isAuthErrorStatus(err.statusCode)
		) {
			throw new ORPCError(AUTH_ERROR_CODES[err.statusCode], {
				message: err.message,
			});
		}
		throw err;
	}
}

/**
 * Response headers of the call (ResponseHeadersPlugin). Checked before a
 * Better Auth call that sets cookies — without them the new session would
 * exist server-side but never reach the browser.
 */
export function requireResponseHeaders(context: {
	resHeaders?: Headers;
}): Headers {
	if (!context.resHeaders) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Response headers are unavailable",
		});
	}
	return context.resHeaders;
}

/** Copies every Set-Cookie of a Better Auth response onto the oRPC response. */
export function forwardSetCookies(from: Headers, to: Headers): void {
	for (const cookie of from.getSetCookie()) {
		to.append("set-cookie", cookie);
	}
}
