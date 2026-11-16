import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * The marketing footer's kit "Privacy settings" action wraps the trigger
 * the server footer hands it. In `next dev` that trigger can arrive as a
 * lazy element (React Flight); `cloneElement` on it rendered `undefined`
 * and the whole marketing site answered 500. The action must render a
 * lazy trigger as well as a plain one.
 *
 * `@fuutu/analytics/consent` is mocked: the real module pulls in the whole
 * `@fuutu/ui` barrel, next-intl and the env schema, a cold transform that
 * outran the 5 s test timeout on CI runners. Only its `openConsentBanner`
 * reaches this component.
 */

const consent = vi.hoisted(() => ({ openConsentBanner: vi.fn() }));
vi.mock("../../../analytics/src/consent.tsx", () => consent);

const ROOT = join(import.meta.dirname, "../../../..");
const MARKETING = join(ROOT, "apps/marketing");
const requireFromMarketing = createRequire(join(MARKETING, "package.json"));
type El = { type: unknown; props: Record<string, unknown> };
const { createElement } = requireFromMarketing("react") as {
	createElement: (type: unknown, props: unknown, ...children: unknown[]) => El;
};
const { renderToStaticMarkup } = requireFromMarketing("react-dom/server") as {
	renderToStaticMarkup: (element: El) => string;
};

async function loadAction() {
	// Non-literal path: a `.tsx` module this package's tsc must not follow.
	const mod = (await import(
		/* @vite-ignore */ join(
			MARKETING,
			"src/modules/marketing/components/privacy-settings-action.tsx",
		)
	)) as { PrivacySettingsAction: unknown };
	return mod.PrivacySettingsAction;
}

const button = () =>
	createElement("button", { type: "button" }, "Privacy settings");

/** A resolved lazy element, the shape React Flight hands client components in dev. */
const lazy = (element: El) => ({
	$$typeof: Symbol.for("react.lazy"),
	// A settled thenable: `use()` reads `status` / `value` synchronously.
	_payload: Object.assign(Promise.resolve(element), {
		status: "fulfilled",
		value: element,
	}),
	_init: (payload: { value: El }) => payload.value,
});

describe("marketing PrivacySettingsAction", () => {
	it("renders a plain trigger", async () => {
		const Action = await loadAction();
		expect(
			renderToStaticMarkup(createElement(Action, { trigger: button() })),
		).toBe('<button type="button">Privacy settings</button>');
	});

	it("the trigger's click reopens the consent banner", async () => {
		const Action = await loadAction();
		const Probe = (props: { onClick?: () => void }) => {
			props.onClick?.();
			return createElement("button", { type: "button" }, "Privacy settings");
		};
		consent.openConsentBanner.mockClear();
		renderToStaticMarkup(
			createElement(Action, { trigger: createElement(Probe, {}) }),
		);
		expect(consent.openConsentBanner).toHaveBeenCalledOnce();
	});

	it("renders a lazy trigger (next dev)", async () => {
		const Action = await loadAction();
		expect(
			renderToStaticMarkup(createElement(Action, { trigger: lazy(button()) })),
		).toBe('<button type="button">Privacy settings</button>');
	});
});
