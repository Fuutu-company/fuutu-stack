import { config } from "@fuutu/config";
import { BrandLogo } from "@fuutu/ui";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appDocs } from "@/app-docs";

/** The "Privacy settings" button in the docs sidebar footer and on the docs home. */
export const PRIVACY_LINK_CLASS =
	"cursor-pointer text-fd-muted-foreground text-xs hover:text-fd-foreground hover:underline hover:underline-offset-4";

export function baseOptions(): BaseLayoutProps {
	const Logo = appDocs.Logo;
	return {
		nav: {
			title: (
				<span className="flex items-center gap-2.5">
					{Logo ? (
						<Logo />
					) : (
						<BrandLogo
							size="md"
							alt={config.app.name}
							className="size-6 dark:invert"
						/>
					)}
					<span className="font-semibold text-sm tracking-tight">
						{config.app.name}
					</span>
				</span>
			),
		},
		// The app's repository (`config.app.contact.githubUrl`); empty = no link.
		githubUrl: config.app.contact.githubUrl || undefined,
	};
}
