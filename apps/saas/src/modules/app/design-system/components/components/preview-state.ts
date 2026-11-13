/** Preview states and the props that pin them. Plain module: safe in server and client components. */
export const PREVIEW_STATES = [
	"default",
	"hover",
	"focus",
	"active",
	"disabled",
	"invalid",
] as const;

export type PreviewState = (typeof PREVIEW_STATES)[number];

/** `data-preview` values pinned by the variant overrides in globals.css. */
const PINNED = {
	hover: "hover",
	focus: "focus focus-visible",
	active: "active",
} as const;

type PreviewProps = {
	"data-preview"?: string;
	disabled?: boolean;
	"aria-invalid"?: true;
};

/**
 * Props that put a primitive into `state` without interaction: hover, focus
 * and active are pinned through `data-preview`; disabled and invalid use the
 * real `disabled` / `aria-invalid` the components already style.
 */
export function previewProps(state: PreviewState): PreviewProps {
	switch (state) {
		case "hover":
		case "focus":
		case "active":
			return { "data-preview": PINNED[state] };
		case "disabled":
			return { disabled: true };
		case "invalid":
			return { "aria-invalid": true };
		default:
			return {};
	}
}
