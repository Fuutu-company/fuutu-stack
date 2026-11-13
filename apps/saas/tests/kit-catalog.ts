import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { API_KEY_DEFAULT_SCOPES } from "../../../packages/api/src/api-key-scopes";
import {
	PLAN_IDS,
	PLANS,
	type Plan,
} from "../../../packages/payments/src/config";

/**
 * Values E2E specs derive from the app's own catalog and copy instead of
 * hard-coding the kit demo ("Pro", "Upgrade to Pro", …) — an app that
 * replaces PLANS, API-key defaults or wording keeps the specs meaningful.
 */

type Messages = Record<string, unknown>;

/** English messages of one translation file, e.g. `common/payments.json`. */
function enMessages(file: string): Messages {
	return JSON.parse(
		readFileSync(
			resolve(__dirname, `../../../packages/i18n/translations/en/${file}`),
			"utf-8",
		),
	);
}

function messageAt(messages: Messages, path: string): string {
	const value = path
		.split(".")
		.reduce<unknown>(
			(node, key) =>
				node && typeof node === "object" ? (node as Messages)[key] : undefined,
			messages,
		);
	if (typeof value !== "string") throw new Error(`missing message ${path}`);
	return value;
}

/**
 * Resolves `{name}` and `{n, plural, one {…} other {…}}` (`#` = n) — the
 * ICU subset kit copy uses — so specs can assert the rendered text.
 */
export function formatMessage(
	message: string,
	values: Record<string, string | number>,
): string {
	return message
		.replace(
			/\{(\w+), plural,((?:\s*[=\w]+\s*\{[^{}]*\})+)\s*\}/g,
			(_, name: string, branches: string) => {
				const n = Number(values[name]);
				const forms = new Map(
					[...branches.matchAll(/([=\w]+)\s*\{([^{}]*)\}/g)].map((m) => [
						m[1] ?? "",
						m[2] ?? "",
					]),
				);
				const form =
					forms.get(`=${n}`) ??
					forms.get(new Intl.PluralRules("en").select(n)) ??
					forms.get("other") ??
					"";
				return form.replace(/#/g, String(n));
			},
		)
		.replace(/\{(\w+)\}/g, (raw, name: string) =>
			name in values ? String(values[name]) : raw,
		);
}

/** The plan an in-app upgrade CTA checks out: first SaaS-visible paid plan. */
export const upgradePlanId = (() => {
	const id = PLAN_IDS.find((planId) => {
		const plan: Plan = PLANS[planId];
		return (
			plan.showInSaas &&
			(plan.billingType === "subscription" ||
				plan.billingType === "one_time") &&
			!plan.saasCtaDisabled
		);
	});
	if (!id) throw new Error("no checkoutable SaaS plan in PLANS");
	return id;
})();

/** English CTA label of a plan's pricing card. */
export function planCtaLabel(planId: string): string {
	return messageAt(
		enMessages("common/payments.json"),
		`payments.plans.${planId}.ctaLabel`,
	);
}

/** Scopes the create-key dialog pre-checks (`API_KEY_DEFAULT_SCOPES`). */
export const defaultApiKeyScopes: readonly string[] = API_KEY_DEFAULT_SCOPES;

/** English checkbox label of an API-key scope. */
export function apiKeyScopeLabel(scope: string): string {
	return messageAt(enMessages("saas/api-keys.json"), `apiKeys.scopes.${scope}`);
}

/** English copy under `organizations.settings.*`, formatted with `values`. */
export function orgSettingsCopy(
	key: string,
	values: Record<string, string | number> = {},
): string {
	return formatMessage(
		messageAt(
			enMessages("saas/organizations.json"),
			`organizations.settings.${key}`,
		),
		values,
	);
}
