import type { DesktopFeatureId } from "./config";

/**
 * - `granted`: the account may use the app.
 * - `trial`: no entitlement yet, inside `trial.days` from sign-up.
 * - `missing`: the plan lacks `access.requiredFeature` (buy in the browser).
 * - `device_limit`: more signed-in installs than `devices.limit` — sign one
 *   out (app or saas settings).
 */
export type DesktopAccessStatus =
	| "granted"
	| "trial"
	| "missing"
	| "device_limit";

export type DesktopAccess = {
	status: DesktopAccessStatus;
	trialEndsAt: Date | null;
	/**
	 * Highest app major version the account is licensed for — `null`:
	 * every major (no per-major licensing, or all listed majors entitled).
	 */
	maxLicensedMajor: number | null;
};

export type DesktopAccessPolicy = {
	requiredFeature: DesktopFeatureId | null;
	perMajorVersion: boolean;
	majors: Partial<Record<number, DesktopFeatureId>>;
	trialDays: number | null;
	deviceLimit: number | null;
};

const DAY_MS = 86_400_000;

/**
 * Majors are cumulative: the first listed major whose feature the account
 * lacks caps the licence just below it.
 */
export function maxLicensedMajor(
	policy: Pick<DesktopAccessPolicy, "perMajorVersion" | "majors">,
	features: readonly string[],
): number | null {
	if (!policy.perMajorVersion) return null;
	const listed = Object.entries(policy.majors)
		.map(([major, feature]) => [Number(major), feature] as const)
		.filter(([major]) => Number.isInteger(major) && major > 0)
		.sort(([a], [b]) => a - b);
	for (const [major, feature] of listed) {
		if (!feature || !features.includes(feature)) return major - 1;
	}
	return null;
}

/**
 * The highest major a caller WITHOUT an account may update to — what an
 * account with no features is licensed for (`null` = every major). The
 * version a caller reports proves nothing, so it never raises this.
 */
export function anonymousMaxMajor(
	policy: Pick<DesktopAccessPolicy, "perMajorVersion" | "majors">,
): number | null {
	return maxLicensedMajor(policy, []);
}

/** Access decision for one account — pure, shared by API and tests. */
export function evaluateDesktopAccess(
	input: DesktopAccessPolicy & {
		features: readonly string[];
		userCreatedAt: Date;
		deviceCount: number;
		now: Date;
	},
): DesktopAccess {
	const entitled =
		input.requiredFeature === null ||
		input.features.includes(input.requiredFeature);
	const trialEndsAt =
		!entitled && input.trialDays !== null
			? new Date(input.userCreatedAt.getTime() + input.trialDays * DAY_MS)
			: null;
	const inTrial = trialEndsAt !== null && input.now < trialEndsAt;
	let status: DesktopAccessStatus = entitled
		? "granted"
		: inTrial
			? "trial"
			: "missing";
	if (
		status !== "missing" &&
		input.deviceLimit !== null &&
		input.deviceCount > input.deviceLimit
	) {
		status = "device_limit";
	}
	return {
		status,
		trialEndsAt: inTrial ? trialEndsAt : null,
		maxLicensedMajor: maxLicensedMajor(input, input.features),
	};
}
