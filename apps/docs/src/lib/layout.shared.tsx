import { config } from "@fuutu/config";
import { BrandLogo } from "@fuutu/ui";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** The "Privacy settings" button in the docs sidebar footer and on the docs home. */
export const PRIVACY_LINK_CLASS =
	"cursor-pointer text-fd-muted-foreground text-xs hover:text-fd-foreground hover:underline hover:underline-offset-4";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<span className="flex items-center gap-2.5">
					<BrandLogo
						size="md"
						alt={config.app.name}
						className="size-6 dark:invert"
					/>
					<span className="font-semibold text-sm tracking-tight">
						{config.app.name}
					</span>
				</span>
			),
		},
		githubUrl: "https://github.com/Fuutu-company/fuutu-stack",
	};
}
