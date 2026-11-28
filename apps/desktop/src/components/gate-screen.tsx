"use client";

import { config } from "@fuutu/config";
import { AreaBackdrop, BrandLogo } from "@fuutu/ui";
import type { PropsWithChildren } from "react";

/** Full-window screen in the SaaS app's auth layout (backdrop, logo, card). */
export function GateScreen({ children }: PropsWithChildren) {
	return (
		<div className="relative isolate flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 sm:p-10">
			<AreaBackdrop />
			<div className="flex w-full max-w-md flex-col gap-6">
				<div className="flex items-center gap-2.5 self-center font-extrabold font-heading text-lg tracking-heading">
					<BrandLogo size="lg" className="logo-dark" />
					{config.app.name}
				</div>
				{children}
			</div>
		</div>
	);
}
