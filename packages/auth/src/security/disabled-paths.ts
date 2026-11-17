/**
 * Organization mutations wrapped by the oRPC `organizations.*` procedures
 * (slug rules, plan limits, rate limits, webhooks, role checks) — closed
 * to direct HTTP via `disabledPaths`.
 */
export const ORGANIZATION_MUTATION_PATHS = [
	"/organization/create",
	"/organization/update",
	"/organization/delete",
	"/organization/invite-member",
	"/organization/update-member-role",
	"/organization/remove-member",
	"/organization/cancel-invitation",
];

/**
 * Organization reads with invitee emails for any member — the kit UI lists
 * invitations through the oRPC `organizations.invitations.list`
 * (INVITE_MEMBER). Closed with the mutations above.
 */
export const ORGANIZATION_INVITATION_READ_PATHS = [
	"/organization/list-invitations",
];

/**
 * Better Auth `disabledPaths`. The JWT plugin's session-to-JWT route
 * (`/token`) would mint tokens signed with the same key as MCP access
 * tokens — disabled per the oauth-provider docs.
 *
 * Every admin-plugin endpoint is closed to direct HTTP too: support
 * actions run through the audited oRPC procedures, which call
 * `auth.api.*` server-side (not affected by `disabledPaths`).
 * `authConfig.admin.exposeAuthEndpoints` opts back in. Same for the
 * organization mutations (`authConfig.organizations.exposeAuthEndpoints`).
 */
export function composeDisabledPaths(input: {
	mcpOAuthActive: boolean;
	adminEndpointPaths: readonly string[];
	exposeAdminEndpoints: boolean;
	exposeOrganizationEndpoints: boolean;
}): string[] {
	return [
		...(input.mcpOAuthActive ? ["/token"] : []),
		...(input.exposeAdminEndpoints ? [] : input.adminEndpointPaths),
		...(input.exposeOrganizationEndpoints
			? []
			: [
					...ORGANIZATION_MUTATION_PATHS,
					...ORGANIZATION_INVITATION_READ_PATHS,
				]),
	];
}
