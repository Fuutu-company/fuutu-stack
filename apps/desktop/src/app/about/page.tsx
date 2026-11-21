"use client";

import { config, KIT_NAME } from "@fuutu/config";
import { BrandLogo, Button, Card } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { appAboutSection } from "@/app-about";
import { inDesktop } from "@/lib/desktop";

type Notice = {
	ecosystem: "npm" | "cargo" | "sidecar";
	name: string;
	version: string;
	license: string | null;
	repository: string | null;
	text: string | null;
};

async function loadNotices(): Promise<Notice[]> {
	const res = await fetch("/third-party-notices.json");
	if (!res.ok) return [];
	return ((await res.json()) as { packages: Notice[] }).packages;
}

/** Your section (src/app-about.tsx), above the notices. */
const AppAboutSection = appAboutSection;

/** About window (second webview): version, kit attribution, notices. */
export default function AboutPage() {
	const t = useTranslations("desktop.about");
	const [version, setVersion] = useState<string | null>(null);
	const notices = useQuery({ queryKey: ["notices"], queryFn: loadNotices });

	useEffect(() => {
		document.title = t("title", { appName: config.app.name });
		if (!inDesktop()) return;
		void import("@tauri-apps/api/app").then(({ getVersion }) =>
			getVersion().then(setVersion),
		);
	}, [t]);

	async function openLogs() {
		const { appLogDir } = await import("@tauri-apps/api/path");
		const { openPath } = await import("@tauri-apps/plugin-opener");
		await openPath(await appLogDir());
	}

	return (
		<main className="flex h-screen flex-col gap-6 overflow-y-auto bg-background p-6">
			<header className="flex items-center gap-3">
				<BrandLogo size="xl" className="dark:invert" />
				<div className="min-w-0 space-y-0.5">
					<h1 className="font-extrabold font-heading text-xl tracking-heading">
						{t("title", { appName: config.app.name })}
					</h1>
					{version ? (
						<p className="text-muted-foreground text-sm">
							{t("version", { version })}
						</p>
					) : null}
					{/* Descriptive attribution — allowed by LICENSE.md §8. */}
					<p className="text-muted-foreground text-sm">
						{t("builtWith", { kitName: KIT_NAME.replace("-", " ") })}
					</p>
				</div>
				{inDesktop() ? (
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						onClick={() => void openLogs()}
					>
						<FolderOpen className="size-4" />
						{t("logs")}
					</Button>
				) : null}
			</header>
			{AppAboutSection ? (
				<Card className="p-6">
					<AppAboutSection />
				</Card>
			) : null}
			<Card className="p-6">
				<section className="space-y-4">
					<div className="space-y-1">
						<h2 className="font-bold font-heading text-lg tracking-heading">
							{t("notices.title")}
						</h2>
						<p className="text-muted-foreground text-sm">
							{t("notices.description", { appName: config.app.name })}
						</p>
					</div>
					{notices.data && notices.data.length > 0 ? (
						<ul className="divide-y overflow-hidden rounded-xl border text-sm">
							{notices.data.map((notice) => (
								<li
									key={`${notice.ecosystem}:${notice.name}@${notice.version}`}
								>
									<details className="group">
										<summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 hover:bg-muted/60">
											<span className="min-w-0 truncate font-medium">
												{notice.name}
											</span>
											<span className="text-muted-foreground">
												{notice.version}
											</span>
											<span className="ml-auto shrink-0 text-muted-foreground text-xs">
												{notice.license ?? "—"}
											</span>
										</summary>
										{notice.text ? (
											<pre className="mx-4 mb-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-muted-foreground text-xs">
												{notice.text}
											</pre>
										) : null}
									</details>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-sm">
							{t("notices.empty")}
						</p>
					)}
				</section>
			</Card>
		</main>
	);
}
