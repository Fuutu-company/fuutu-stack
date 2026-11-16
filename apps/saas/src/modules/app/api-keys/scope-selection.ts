/**
 * Scope selection of the API key create dialog. Pure, so the rules are
 * testable without rendering; the API re-checks every scope.
 */

/** Scopes the viewer may pick: admin-only ones only for system admins. */
export function offeredApiKeyScopes<S extends string>(
	all: readonly S[],
	adminOnly: readonly S[],
	isSystemAdmin: boolean,
): S[] {
	return all.filter((scope) => isSystemAdmin || !adminOnly.includes(scope));
}

/**
 * Scopes checked when the dialog opens: the preset, limited to the offered
 * scopes (an unknown or admin-only preset entry is dropped), in offered order.
 */
export function initialApiKeyScopes<S extends string>(
	offered: readonly S[],
	preset: readonly string[],
): S[] {
	return offered.filter((scope) => preset.includes(scope));
}
