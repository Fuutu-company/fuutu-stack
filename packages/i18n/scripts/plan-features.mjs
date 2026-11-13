/**
 * Plan feature-list detection for check-translations — dependency-free so
 * `node scripts/check-translations.mjs` needs no TypeScript loader. Mirrors
 * the render path of `buildPricingTiers()` (packages/payments/src/plans.ts):
 * a plan renders when `showInSaas || showInMarketing`, it lists every
 * non-hidden FEATURE_CATALOG entry up to its tier (`getPricingFeaturesForPlan`,
 * a plan without `tier` counts as "free"), and each label is read from
 * `payments.plans.<planId>.featureLabels.<featureId>` — a missing label
 * falls back to the raw feature id on screen. Parity with the real
 * functions is pinned in packages/payments/src/__tests__/plans.test.ts.
 */

/** Blank out comments, keeping string literals (and offsets) intact. */
function blankComments(source) {
	let out = "";
	let state = null; // quote char | "line" | "block"
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		const next = source[i + 1];
		if (state === "line") {
			if (ch === "\n") {
				state = null;
				out += ch;
			} else out += " ";
			continue;
		}
		if (state === "block") {
			if (ch === "*" && next === "/") {
				state = null;
				out += "  ";
				i++;
			} else out += ch === "\n" ? "\n" : " ";
			continue;
		}
		if (state !== null) {
			out += ch;
			if (ch === "\\") {
				out += next ?? "";
				i++;
			} else if (ch === state) state = null;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === "`") {
			state = ch;
			out += ch;
		} else if (ch === "/" && next === "/") {
			state = "line";
			out += "  ";
			i++;
		} else if (ch === "/" && next === "*") {
			state = "block";
			out += "  ";
			i++;
		} else out += ch;
	}
	return out;
}

/**
 * Top-level `key: value` pairs of the object literal starting at `start`
 * (the index of its `{`), as source strings. String-literal aware; expects
 * comments already blanked. Returns null when the literal is unterminated.
 */
function objectEntries(text, start) {
	const entries = {};
	let depth = 0;
	let quote = null;
	let key = null;
	let token = "";
	let valueStart = -1;
	for (let i = start; i < text.length; i++) {
		const ch = text[i];
		if (quote !== null) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = null;
			else if (depth === 1 && key === null) token += ch;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === "`") {
			quote = ch;
			continue;
		}
		if (ch === "{" || ch === "[" || ch === "(") {
			depth++;
			continue;
		}
		if (ch === "}" || ch === "]" || ch === ")") {
			depth--;
			if (depth === 0) {
				if (key !== null) entries[key] = text.slice(valueStart, i).trim();
				return entries;
			}
			continue;
		}
		if (depth !== 1) continue;
		if (ch === ":" && key === null) {
			key = token.trim();
			token = "";
			valueStart = i + 1;
		} else if (ch === ",") {
			if (key !== null) entries[key] = text.slice(valueStart, i).trim();
			key = null;
			token = "";
		} else if (key === null) {
			token += ch;
		}
	}
	return null;
}

function exportedObject(text, name) {
	const match = text.match(
		new RegExp(`export\\s+const\\s+${name}\\b[^=]*=\\s*\\{`),
	);
	if (!match) return null;
	return objectEntries(text, match.index + match[0].length - 1);
}

function nestedObject(valueSource) {
	return valueSource.startsWith("{") ? objectEntries(valueSource, 0) : null;
}

function stringValue(valueSource) {
	return valueSource?.match(/^["'`]([^"'`]*)["'`]$/)?.[1];
}

/**
 * Feature ids each rendered plan shows, keyed by plan id, in catalog order.
 * Returns null when PLANS, TIER_ORDER or FEATURE_CATALOG cannot be read.
 */
export function extractVisiblePlanFeatures(configSource) {
	const text = blankComments(configSource);
	const plans = exportedObject(text, "PLANS");
	const catalog = exportedObject(text, "FEATURE_CATALOG");
	const tierOrder = text
		.match(/export\s+const\s+TIER_ORDER\b[^=]*=\s*\[([^\]]*)\]/)?.[1]
		?.split(",")
		.map((part) => stringValue(part.trim()))
		.filter(Boolean);
	if (!plans || !catalog || !tierOrder || tierOrder.length === 0) return null;

	const features = [];
	for (const [group, groupSource] of Object.entries(catalog)) {
		for (const [key, entrySource] of Object.entries(
			nestedObject(groupSource) ?? {},
		)) {
			const entry = nestedObject(entrySource) ?? {};
			if (entry.hidden === "true") continue;
			features.push({
				id: `${group}_${key}`,
				rank: tierOrder.indexOf(stringValue(entry.tier) ?? ""),
			});
		}
	}

	const result = {};
	for (const [planId, planSource] of Object.entries(plans)) {
		const plan = nestedObject(planSource) ?? {};
		if (plan.showInSaas !== "true" && plan.showInMarketing !== "true") {
			continue;
		}
		const rank = tierOrder.indexOf(stringValue(plan.tier) ?? "free");
		result[planId] = features
			.filter((f) => f.rank !== -1 && f.rank <= rank)
			.map((f) => f.id);
	}
	return result;
}

/**
 * Errors for every rendered feature without a non-empty label in
 * `payments.plans.<planId>.featureLabels` of one locale.
 */
export function findMissingPlanFeatureLabels(planFeatures, plans, locale) {
	const errors = [];
	for (const [planId, featureIds] of Object.entries(planFeatures)) {
		const labels = plans?.[planId]?.featureLabels ?? {};
		for (const featureId of featureIds) {
			const label = labels[featureId];
			if (typeof label !== "string" || label.trim() === "") {
				errors.push(
					`[${locale}] Missing plan feature label: payments.plans.${planId}.featureLabels.${featureId}`,
				);
			}
		}
	}
	return errors;
}
