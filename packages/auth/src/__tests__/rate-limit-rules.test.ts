import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { organization } from "better-auth/plugins";
import { beforeEach, describe, expect, it } from "vitest";
import { readOnlyRateLimitRules } from "../rate-limit-rules";

// Better Auth counts a path until it has been idle for a full window, so
// pages that keep reading the session and the org list (every page, the
// billing page while it polls) answered 429 on those GETs after
// `rateLimiting.max` requests per IP, with no quiet window in between.

const current = { window: 60, max: 100 };
const request = (path: string, method = "GET") =>
	new Request(`http://localhost/api/auth${path}`, { method });

describe("readOnlyRateLimitRules", () => {
	const rules = readOnlyRateLimitRules();

	it("covers exactly the session read, the org list and the full-org read", () => {
		expect(Object.keys(rules).sort()).toEqual([
			"/get-session",
			"/organization/get-full-organization",
			"/organization/list",
		]);
	});

	it.each(["/get-session", "/organization/list"])(
		"GET %s is not rate limited",
		async (path) => {
			expect(await rules[path]?.(request(path), current)).toBe(false);
		},
	);

	it("GET /organization/get-full-organization has a burst limit (members and invitations), not an exemption", async () => {
		const path = "/organization/get-full-organization";
		expect(await rules[path]?.(request(path), current)).toEqual({
			window: 2,
			max: 30,
		});
	});

	it.each([
		["/get-session", "POST"],
		["/organization/list", "POST"],
		["/organization/get-full-organization", "POST"],
		["/organization/list", "DELETE"],
	])("%s %s keeps the current limit", async (path, method) => {
		expect(await rules[path]?.(request(path, method), current)).toEqual(
			current,
		);
	});
});

/**
 * The rules in a real Better Auth instance: its own path matching decides
 * which requests a rule sees, so this pins that the exemption stays on
 * the exact paths (no wildcard, no prefix) after a better-auth bump.
 */
describe("read-only rate limit rules in Better Auth", () => {
	const MAX = 3;
	// Better Auth's memory store is module-global: a fresh client IP per
	// case keeps the counts of one case out of the next.
	let ipCounter = 0;
	let ip = "";
	beforeEach(() => {
		ipCounter += 1;
		ip = `203.0.113.${ipCounter}`;
	});

	function createAuth() {
		return betterAuth({
			baseURL: "http://localhost",
			secret: "test-secret-test-secret-test-secret-12",
			database: memoryAdapter({
				user: [],
				session: [],
				account: [],
				verification: [],
				organization: [],
				member: [],
				invitation: [],
			}),
			plugins: [organization()],
			logger: { disabled: true },
			rateLimit: {
				enabled: true,
				window: 60,
				max: MAX,
				storage: "memory",
				customRules: readOnlyRateLimitRules(),
			},
		});
	}

	async function statuses(
		auth: ReturnType<typeof createAuth>,
		path: string,
		times: number,
		method = "GET",
	): Promise<number[]> {
		const result: number[] = [];
		for (let i = 0; i < times; i++) {
			const headers = new Headers({ "x-forwarded-for": ip });
			if (method !== "GET") headers.set("content-type", "application/json");
			const response = await auth.handler(
				new Request(`http://localhost/api/auth${path}`, {
					method,
					headers,
					...(method !== "GET" && { body: "{}" }),
				}),
			);
			result.push(response.status);
		}
		return result;
	}

	it.each(["/get-session", "/organization/list"])(
		"GET %s is never answered 429",
		async (path) => {
			const auth = createAuth();
			expect(await statuses(auth, path, MAX * 3)).not.toContain(429);
		},
	);

	it("GET /organization/get-full-organization is limited to 30 per 2 seconds", async () => {
		const auth = createAuth();
		const result = await statuses(
			auth,
			"/organization/get-full-organization",
			31,
		);
		expect(result.slice(0, 30)).not.toContain(429);
		expect(result[30]).toBe(429);
	});

	it("a POST to an exempt path is still limited", async () => {
		const auth = createAuth();
		const result = await statuses(auth, "/get-session", MAX + 1, "POST");
		expect(result.slice(0, MAX)).not.toContain(429);
		expect(result[MAX]).toBe(429);
	});

	it.each(["/ok", "/organization/list-members"])(
		"GET %s (no exact match) keeps the global limit",
		async (path) => {
			const auth = createAuth();
			const result = await statuses(auth, path, MAX + 1);
			expect(result.slice(0, MAX)).not.toContain(429);
			expect(result[MAX]).toBe(429);
		},
	);
});
