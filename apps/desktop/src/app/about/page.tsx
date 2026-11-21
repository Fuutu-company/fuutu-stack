"use client";

import { config, KIT_NAME } from "@fuutu/config";
import { Button, Separator } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
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
		<main className="flex h-screen flex-col gap-4 overflow-y-auto p-6">
			<div className="flex flex-col gap-1">
				<h1 className="font-heading font-semibold text-xl">
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
				<div>
					<Button variant="outline" size="sm" onClick={() => void openLogs()}>
						{t("logs")}
					</Button>
				</div>
			) : null}
			{AppAboutSection ? (
				<>
					<Separator />
					<AppAboutSection />
				</>
			) : null}
			<Separator />
			<section className="flex flex-col gap-2">
				<h2 className="font-medium">{t("notices.title")}</h2>
				<p className="text-muted-foreground text-sm">
					{t("notices.description", { appName: config.app.name })}
				</p>
				{notices.data && notices.data.length > 0 ? (
					<ul className="flex flex-col gap-1 text-sm">
						{notices.data.map((notice) => (
							<li key={`${notice.ecosystem}:${notice.name}@${notice.version}`}>
								<details>
									<summary className="cursor-pointer">
										{notice.name} {notice.version}
										<span className="text-muted-foreground">
											{" "}
											· {notice.license ?? "—"}
										</span>
									</summary>
									{notice.text ? (
										<pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-muted-foreground text-xs">
											{notice.text}
										</pre>
									) : null}
								</details>
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground text-sm">{t("notices.empty")}</p>
				)}
			</section>
		</main>
	);
}
