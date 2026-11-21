import { createLogger } from "@fuutu/logs";
import { Button, Card } from "@fuutu/ui";
import { PageIntro } from "@shared/components/page-intro";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { appMarketing } from "@/app-marketing";
import { isKitRouteEnabled } from "@/lib/kit-routes";
import { pageMetadata, withAppMetadata } from "@/lib/page-metadata";
import { urls } from "@/lib/urls";

const log = createLogger({ scope: "marketing-download" });

const PLATFORMS = ["macos", "windows", "linux"] as const;
type Platform = (typeof PLATFORMS)[number];

/** Re-read the current release at most every five minutes. */
export const revalidate = 300;

interface DownloadPageProps {
	params: Promise<{ locale: string }>;
}

/**
 * The current desktop release from `apps/saas` (`GET /api/desktop/download`,
 * public) — over HTTP, marketing never imports the API. `null` while the
 * app is unreachable.
 */
async function loadRelease(): Promise<{
	version: string | null;
	platforms: Platform[];
} | null> {
	// Switched off: the layout 404s — no request to the app at build time.
	if (!isKitRouteEnabled("download")) return null;
	try {
		const res = await fetch(`${urls.app}/api/desktop/download`, {
			next: { revalidate },
		});
		if (!res.ok) return null;
		const body = (await res.json()) as {
			version?: unknown;
			platforms?: unknown;
		};
		return {
			version: typeof body.version === "string" ? body.version : null,
			platforms: Array.isArray(body.platforms)
				? PLATFORMS.filter((p) => (body.platforms as unknown[]).includes(p))
				: [],
		};
	} catch (err) {
		log.warn("desktop release unavailable", { err: String(err) });
		return null;
	}
}

export async function generateMetadata({
	params,
}: DownloadPageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "download" });
	return withAppMetadata(
		pageMetadata({
			locale,
			path: "/download",
			title: t("title"),
			description: t("description"),
		}),
		appMarketing.metadata?.download,
		locale,
	);
}

export default async function DownloadPage({ params }: DownloadPageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("download");
	const release = await loadRelease();
	const platforms = release?.platforms ?? [];

	return (
		<div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 md:pt-20">
			<PageIntro title={t("title")} description={t("description")} />
			{release?.version ? (
				<p className="mt-6 text-muted-foreground text-sm">
					{t("version", { version: release.version })}
				</p>
			) : null}
			{platforms.length === 0 ? (
				<p className="mt-12 text-muted-foreground">{t("unavailable")}</p>
			) : (
				<ul className="mt-12 grid gap-4 sm:grid-cols-3">
					{platforms.map((platform) => (
						<li key={platform}>
							<Card className="h-full items-start gap-4 px-6 py-6">
								<h2 className="font-extrabold font-heading text-xl tracking-heading">
									{t(`platforms.${platform}.name`)}
								</h2>
								<p className="text-muted-foreground text-sm">
									{t(`platforms.${platform}.requirements`)}
								</p>
								<Button asChild className="mt-auto">
									<a href={`${urls.app}/api/desktop/download/${platform}`}>
										<Download aria-hidden />
										{t("cta")}
									</a>
								</Button>
							</Card>
						</li>
					))}
				</ul>
			)}
			<p className="mt-8 text-muted-foreground text-sm">{t("signInNote")}</p>
		</div>
	);
}
