import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import { assertProfileInput } from "../hooks/profile-input";

const session = async () => ({
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-active" },
});

async function rejection(input: Parameters<typeof assertProfileInput>[0]) {
	return assertProfileInput(input).then(
		() => undefined,
		(e: unknown) => e,
	);
}

describe("assertProfileInput — names", () => {
	it.each([
		["/sign-up/email", { name: "x".repeat(101) }],
		["/update-user", { name: "x".repeat(101) }],
		["/organization/create", { name: "x".repeat(101), slug: "acme" }],
		["/organization/update", { data: { name: "x".repeat(101) } }],
	])("rejects a name over 100 characters on %s", async (path, body) => {
		const error = await rejection({ path, body, getSession: session });
		expect(error).toBeInstanceOf(APIError);
		expect(error).toMatchObject({ statusCode: 400 });
	});

	it("accepts a 100-character name", async () => {
		await expect(
			assertProfileInput({
				path: "/update-user",
				body: { name: "x".repeat(100) },
				getSession: session,
			}),
		).resolves.toBeUndefined();
	});
});

describe("assertProfileInput — user image", () => {
	it.each([
		"https://tracker.example/pixel.gif",
		"//tracker.example/pixel.gif",
		"/image-proxy/avatars/other-user/me.png",
		"/image-proxy/organization-logos/user-1/me.png",
		"/image-proxy/avatars/user-1/../other-user/me.png",
		"/image-proxy/avatars/user-1/%2e%2e/x.png",
		"/image-proxy/avatars/user-1/",
		"javascript:alert(1)",
	])("rejects %s on /update-user", async (image) => {
		const error = await rejection({
			path: "/update-user",
			body: { image },
			getSession: session,
		});
		expect(error).toBeInstanceOf(APIError);
	});

	it.each([
		null,
		"/image-proxy/avatars/user-1/me.png",
		"/image-proxy/avatars/user-1/2026/me-1.webp",
	])("accepts %s on /update-user", async (image) => {
		await expect(
			assertProfileInput({
				path: "/update-user",
				body: { image },
				getSession: session,
			}),
		).resolves.toBeUndefined();
	});

	it("rejects any image at sign-up (no account to own an upload yet)", async () => {
		const error = await rejection({
			path: "/sign-up/email",
			body: { image: "/image-proxy/avatars/user-1/me.png" },
			getSession: session,
		});
		expect(error).toBeInstanceOf(APIError);
	});

	it("rejects an image when there is no session", async () => {
		const error = await rejection({
			path: "/update-user",
			body: { image: "/image-proxy/avatars/user-1/me.png" },
			getSession: async () => null,
		});
		expect(error).toBeInstanceOf(APIError);
	});

	it("does not read the session for name-only updates", async () => {
		const getSession = vi.fn(session);
		await assertProfileInput({
			path: "/update-user",
			body: { name: "Ada" },
			getSession,
		});
		expect(getSession).not.toHaveBeenCalled();
	});
});

describe("assertProfileInput — organization logo", () => {
	it("accepts the organization's own logo path", async () => {
		await expect(
			assertProfileInput({
				path: "/organization/update",
				body: {
					organizationId: "org-1",
					data: { logo: "/image-proxy/organization-logos/org-1/logo.png" },
				},
				getSession: session,
			}),
		).resolves.toBeUndefined();
	});

	it("falls back to the active organization when no id is sent", async () => {
		await expect(
			assertProfileInput({
				path: "/organization/update",
				body: {
					data: {
						logo: "/image-proxy/organization-logos/org-active/logo.png",
					},
				},
				getSession: session,
			}),
		).resolves.toBeUndefined();
	});

	it.each([
		"/image-proxy/organization-logos/org-2/logo.png",
		"https://tracker.example/pixel.gif",
		"/image-proxy/avatars/org-1/logo.png",
	])("rejects %s for org-1", async (logo) => {
		const error = await rejection({
			path: "/organization/update",
			body: { organizationId: "org-1", data: { logo } },
			getSession: session,
		});
		expect(error).toBeInstanceOf(APIError);
	});

	it("accepts removing the logo", async () => {
		await expect(
			assertProfileInput({
				path: "/organization/update",
				body: { organizationId: "org-1", data: { logo: null } },
				getSession: session,
			}),
		).resolves.toBeUndefined();
	});

	it("rejects a logo on create (no organization id to scope it yet)", async () => {
		const error = await rejection({
			path: "/organization/create",
			body: { name: "Acme", slug: "acme", logo: "https://x.example/a.png" },
			getSession: session,
		});
		expect(error).toBeInstanceOf(APIError);
	});
});

it("ignores other paths", async () => {
	const getSession = vi.fn(session);
	await expect(
		assertProfileInput({
			path: "/sign-in/email",
			body: { name: "x".repeat(500), image: "https://x.example" },
			getSession,
		}),
	).resolves.toBeUndefined();
	expect(getSession).not.toHaveBeenCalled();
});
