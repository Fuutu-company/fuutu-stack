import { describe, expect, it, vi } from "vitest";
import { assertDeleteUserReauth } from "../hooks/delete-user-reauth";

const NOW = new Date("2026-11-17T12:00:00Z").getTime();
const session = (minutesAgo: number) => async () => ({
	user: { id: "user-1" },
	session: { createdAt: new Date(NOW - minutesAgo * 60_000) },
});

const run = (input: {
	body?: unknown;
	hasPassword: boolean;
	signedInMinutesAgo?: number;
	path?: string;
}) =>
	assertDeleteUserReauth({
		path: input.path ?? "/delete-user",
		body: input.body ?? {},
		getSession: session(input.signedInMinutesAgo ?? 1),
		hasPassword: vi.fn(async () => input.hasPassword),
		maxAgeSeconds: 15 * 60,
		now: NOW,
	});

describe("assertDeleteUserReauth", () => {
	it.each([{}, { password: "" }, { password: 42 }])(
		"requires the password for an account that has one (%j)",
		async (body) => {
			await expect(run({ body, hasPassword: true })).rejects.toMatchObject({
				statusCode: 400,
				body: { code: "PASSWORD_REQUIRED" },
			});
		},
	);

	it("lets Better Auth verify a given password, however old the session", async () => {
		await expect(
			run({
				body: { password: "Secret!123" },
				hasPassword: true,
				signedInMinutesAgo: 600,
			}),
		).resolves.toBeUndefined();
	});

	it("requires a fresh session for a passwordless account", async () => {
		await expect(
			run({ hasPassword: false, signedInMinutesAgo: 16 }),
		).rejects.toMatchObject({
			statusCode: 403,
			body: { code: "SESSION_NOT_FRESH" },
		});
		await expect(
			run({ hasPassword: false, signedInMinutesAgo: 2 }),
		).resolves.toBeUndefined();
	});

	it("ignores other paths", async () => {
		await expect(
			run({ path: "/update-user", hasPassword: true }),
		).resolves.toBeUndefined();
	});
});
