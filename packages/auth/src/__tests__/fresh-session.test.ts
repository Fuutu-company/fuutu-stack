import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import { assertFreshSession } from "../hooks/fresh-session";

const NOW = new Date("2026-11-17T12:00:00Z").getTime();
const signedInMinutesAgo = (minutes: number) => async () => ({
	session: { createdAt: new Date(NOW - minutes * 60_000) },
});

describe("assertFreshSession", () => {
	it("rejects an email change from a session older than the limit", async () => {
		const error = await assertFreshSession({
			path: "/change-email",
			getSession: signedInMinutesAgo(16),
			maxAgeSeconds: 15 * 60,
			now: NOW,
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(APIError);
		expect(error).toMatchObject({
			statusCode: 403,
			body: { code: "SESSION_NOT_FRESH" },
		});
	});

	it("allows an email change right after signing in", async () => {
		await expect(
			assertFreshSession({
				path: "/change-email",
				getSession: signedInMinutesAgo(2),
				maxAgeSeconds: 15 * 60,
				now: NOW,
			}),
		).resolves.toBeUndefined();
	});

	it("leaves a missing session to the endpoint (401 there)", async () => {
		await expect(
			assertFreshSession({
				path: "/change-email",
				getSession: async () => null,
				maxAgeSeconds: 15 * 60,
				now: NOW,
			}),
		).resolves.toBeUndefined();
	});

	it("never reads the session on other paths", async () => {
		const getSession = vi.fn(signedInMinutesAgo(600));
		await assertFreshSession({
			path: "/update-user",
			getSession,
			maxAgeSeconds: 15 * 60,
			now: NOW,
		});
		expect(getSession).not.toHaveBeenCalled();
	});
});
