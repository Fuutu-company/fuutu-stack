"use client";

import { useTranslations } from "next-intl";
import { PALETTE_GROUPS } from "../../tokens";
import { useTokenValue } from "../../use-measured-contrast";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

function PaletteToken({ token }: { token: string }) {
	const t = useTranslations("designSystem.foundations.palette");
	const value = useTokenValue(token);

	return (
		<li data-testid="palette-token" className="space-y-2">
			<div
				aria-hidden="true"
				className="h-14 rounded-lg border shadow-xs"
				style={{ backgroundColor: `var(--${token})` }}
			/>
			<div className="space-y-0.5">
				<code className="block break-all font-mono text-foreground text-xs">
					--{token}
				</code>
				<span
					data-testid="palette-value"
					className="block break-all font-mono text-muted-foreground text-xs"
				>
					{value ?? t("pending")}
				</span>
			</div>
		</li>
	);
}

export function Palette() {
	const t = useTranslations("designSystem.foundations.palette");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<div className="space-y-8">
				{PALETTE_GROUPS.map(({ key, tokens }) => (
					<div key={key} className="space-y-3">
						<h4 className="font-medium text-sm">{t(`groups.${key}`)}</h4>
						<ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
							{tokens.map((token) => (
								<PaletteToken key={token} token={token} />
							))}
						</ul>
					</div>
				))}
			</div>
		</DesignSubsection>
	);
}
