import type { AppFooterAction } from "@/lib/site-links";

/** Footer link styling — shared by the kit links and the app action buttons. */
export const FOOTER_LINK_CLASS =
	"text-muted-foreground transition-colors hover:text-foreground hover:underline hover:underline-offset-4";

/**
 * One app footer action (`appFooter.actions`): a kit-styled button the
 * app's component wires up (e.g. as a dialog trigger).
 */
export function FooterActionItem({
	action,
	label,
}: {
	action: AppFooterAction;
	label: string;
}) {
	const { Component } = action;
	return (
		<li>
			<Component
				trigger={
					<button
						type="button"
						className={`${FOOTER_LINK_CLASS} cursor-pointer`}
					>
						{label}
					</button>
				}
			/>
		</li>
	);
}
