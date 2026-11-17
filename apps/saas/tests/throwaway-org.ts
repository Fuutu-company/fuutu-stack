import { type APIRequestContext, type Browser, expect } from "@playwright/test";

/**
 * A fresh organization for a test, created through the oRPC API like the
 * app does — Better Auth's own `/api/auth/organization/*` mutations are
 * closed over HTTP. A throwaway user creates it; with `joinAsOwner` the
 * seeded admin (`admin`, the test's signed-in request context) must own it
 * so the test's page can open it: the admin creates it itself when its
 * plan allows another organization, otherwise (the kit's free plan allows
 * one, Acme) the throwaway user's org invites it as owner — which needs a
 * second seat. Creating or joining switches the admin's session to the
 * org; `cleanup` switches it back to the org it had before (the session is
 * shared by every later test), then deletes the organization and the
 * throwaway user.
 */
export async function createThrowawayOrg(input: {
	browser: Browser;
	baseURL: string;
	admin: APIRequestContext;
	name: string;
	slug: string;
	joinAsOwner?: boolean;
}): Promise<{ id: string; cleanup: () => Promise<void> }> {
	// Cookie-authenticated mutations need an Origin.
	const headers = { origin: new URL(input.baseURL).origin };
	const email = `e2e-owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fuutu.local`;
	const context = await input.browser.newContext({
		baseURL: input.baseURL,
		storageState: { cookies: [], origins: [] },
	});
	const owner = context.request;

	let userId: string | undefined;
	let orgId: string | undefined;
	let adminOwned = false;
	let adminActiveOrgId: string | null = null;
	const cleanup = async () => {
		try {
			if (orgId) {
				await (adminOwned ? input.admin : owner).delete(
					`/api/organizations/${orgId}`,
					{ headers },
				);
			}
			if (userId) {
				await input.admin.delete(`/api/admin/users/${userId}`, {
					data: { reason: "E2E cleanup", confirmEmail: email },
					headers,
				});
			}
			if (input.joinAsOwner && orgId) {
				// Past the cookie cache: a cached session that still shows the
				// earlier org makes set-active skip the write.
				const restored = await input.admin.post(
					"/api/auth/organization/set-active?disableCookieCache=true",
					{ data: { organizationId: adminActiveOrgId }, headers },
				);
				expect(restored.ok(), await restored.text()).toBe(true);
			}
		} finally {
			await context.close();
		}
	};

	try {
		if (input.joinAsOwner) {
			const session = await input.admin.get(
				"/api/auth/get-session?disableCookieCache=true",
			);
			expect(session.ok(), await session.text()).toBe(true);
			adminActiveOrgId =
				(
					(await session.json()) as {
						session?: { activeOrganizationId?: string | null };
					} | null
				)?.session?.activeOrganizationId ?? null;

			const created = await input.admin.post("/api/organizations", {
				data: { name: input.name, slug: input.slug },
				headers,
			});
			// 403 = the admin's organization limit; anything else is a failure.
			if (created.status() !== 403) {
				expect(created.ok(), await created.text()).toBe(true);
				orgId = ((await created.json()) as { id: string }).id;
				adminOwned = true;
				return { id: orgId, cleanup };
			}
		}

		const signUp = await owner.post("/api/auth/sign-up/email", {
			data: { email, password: "OwnerPassword!2345", name: "E2E Owner" },
			headers,
		});
		expect(signUp.ok(), await signUp.text()).toBe(true);
		userId = ((await signUp.json()) as { user: { id: string } }).user.id;

		const created = await owner.post("/api/organizations", {
			data: { name: input.name, slug: input.slug },
			headers,
		});
		expect(created.ok(), await created.text()).toBe(true);
		orgId = ((await created.json()) as { id: string }).id;

		if (input.joinAsOwner) {
			const invited = await owner.post(
				`/api/organizations/${orgId}/members/invite`,
				{ data: { email: "admin@fuutu.local", role: "owner" }, headers },
			);
			expect(invited.ok(), await invited.text()).toBe(true);
			const { id: invitationId } = (await invited.json()) as { id: string };
			const accepted = await input.admin.post(
				"/api/auth/organization/accept-invitation",
				{ data: { invitationId }, headers },
			);
			expect(accepted.ok(), await accepted.text()).toBe(true);
		}
	} catch (err) {
		await cleanup();
		throw err;
	}

	if (!orgId) throw new Error("organization was not created");
	return { id: orgId, cleanup };
}
