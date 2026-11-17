import { config, KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { APP_VERSION } from "@fuutu/config/app-version";
import { getOrganizationById, getUserById } from "@fuutu/db";
import { defineMcpTool, McpToolError, requireScopes } from "@fuutu/mcp";
import { z } from "zod";

/**
 * Example tools shipped with the kit — one public, one authenticated.
 * Add your own with `defineMcpTool` and register them in `./index.ts`.
 */

export const appInfoTool = defineMcpTool({
	name: "app_info",
	title: "App info",
	description:
		"Returns this app's name and version plus the Fuutu Stack kit release it is built on.",
	access: "public",
	input: z.object({}),
	annotations: { readOnlyHint: true },
	handler: async () => ({
		app: { name: config.app.name, version: APP_VERSION },
		kit: { name: KIT_NAME, version: KIT_VERSION },
	}),
});

const hasProfileAndEmail = requireScopes("profile", "email");

export const whoamiTool = defineMcpTool({
	name: "whoami",
	title: "Who am I",
	description:
		"Returns the authenticated caller: user, organization, organization role and granted scopes.",
	// Name and email are OIDC `profile` / `email` claims: an OAuth token
	// needs both grants. An API key's scopes are the key's own.
	access: (principal) =>
		principal.via === "api-key" || hasProfileAndEmail(principal),
	input: z.object({}),
	annotations: { readOnlyHint: true },
	handler: async (_input, { principal }) => {
		const user = await getUserById(principal.userId);
		if (!user) throw new McpToolError("User not found");
		const org = principal.organizationId
			? await getOrganizationById(principal.organizationId)
			: null;
		return {
			user: { id: user.id, name: user.name, email: user.email },
			organization: org
				? {
						id: org.id,
						name: org.name,
						slug: org.slug,
						role: principal.orgRole,
					}
				: null,
			scopes: [...principal.scopes],
		};
	},
});
