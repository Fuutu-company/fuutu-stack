import { config } from "@fuutu/config";
import { BrandLogo } from "@fuutu/ui";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

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
