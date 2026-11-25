import { config } from "@fuutu/config";
import { Button, Card } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { baseOptions } from "@/lib/layout.shared";
import { docsSections } from "@/lib/page-tree-sections";
import { source } from "@/lib/source";
import { Link } from "@/navigation";
import { DocsHomeSearch } from "./docs-home-search";

/** "Start here" cards: the first pages of the first section. */
const START_PAGES = 4;
/** Page links per section card under "Find a topic". */
const TOPIC_PAGES = 5;

const FOCUS =
	"outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const SECTION_TITLE =
	"font-bold font-heading text-xl leading-7 tracking-heading";
const ARROW =
	"size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none";
const START_GRID: Record<number, string> = {
	1: "sm:grid-cols-1",
	2: "sm:grid-cols-2",
	3: "sm:grid-cols-2 lg:grid-cols-3",
	4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * The kit docs home: hero with search, the sidebar's sections, the first
 * pages to read and a card per section — all read from the page tree
 * (`lib/page-tree-sections.ts`), so it fits any content without edits.
 * Replace it with `appDocs.Home`.
 */
export async function DocsHome({ locale }: { locale: string }) {
	const t = await getTranslations({ locale, namespace: "home" });
	const sections = docsSections(source.getPageTree(locale));
	const [first, ...rest] = sections;
	const start = first?.pages.slice(0, START_PAGES) ?? [];
	const { githubUrl } = baseOptions();

	return (
		<div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 sm:px-6">
			<div className="grid grid-cols-1 items-center gap-10 pt-16 pb-14 md:pt-24 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<section
					data-docs-home="hero"
					className="flex flex-col items-start gap-6"
				>
					<p className="inline-flex items-center gap-2 font-semibold text-sm">
						<span
							aria-hidden="true"
							className="size-2 rounded-full bg-primary"
						/>
						{t("title", { appName: config.app.name })}
					</p>
					<h1 className="max-w-3xl text-balance font-extrabold font-heading text-[clamp(2.5rem,6vw,4rem)] leading-[1.02] tracking-display">
						{t("subtitle")}
					</h1>
					<p className="max-w-2xl text-lg text-muted-foreground leading-8">
						{t("description")}
					</p>
					<DocsHomeSearch label={t("search")} />
					<div className="flex flex-wrap gap-3">
						<Button asChild size="lg">
							<Link href="/docs">
								{t("exploreDocs")}
								<ArrowRight aria-hidden="true" />
							</Link>
						</Button>
						{githubUrl ? (
							<Button asChild size="lg" variant="outline">
								<a href={githubUrl} target="_blank" rel="noreferrer noopener">
									{t("viewOnGithub")}
									<ArrowUpRight aria-hidden="true" />
								</a>
							</Button>
						) : null}
					</div>
				</section>

				{sections.length > 0 ? (
					<nav data-docs-home="sections" aria-labelledby="docs-home-sections">
						<Card className="gap-0 p-3">
							<div className="flex items-baseline justify-between gap-4 px-4 pt-3 pb-2">
								<h2
									id="docs-home-sections"
									className="font-semibold text-muted-foreground text-sm"
								>
									{t("sections.title")}
								</h2>
								<Link
									href="/docs"
									className={cn(
										"inline-flex items-center gap-1 rounded-sm font-semibold text-sm hover:underline",
										FOCUS,
									)}
								>
									{t("sections.overview")}
									<ArrowRight aria-hidden="true" className="size-3.5" />
								</Link>
							</div>
							<ul>
								{sections.map((section) => (
									<li key={section.key}>
										<NextLink
											href={section.href}
											className={cn(
												"group flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-muted [&_svg]:size-4",
												FOCUS,
											)}
										>
											<span
												aria-hidden="true"
												className="text-muted-foreground empty:hidden"
											>
												{section.icon}
											</span>
											<span className="flex-1 font-bold font-heading text-base">
												{section.name}
											</span>
											<span className="text-muted-foreground text-xs tabular-nums">
												{t("sections.pages", { count: section.pageCount })}
											</span>
											<ArrowRight aria-hidden="true" className={ARROW} />
										</NextLink>
									</li>
								))}
							</ul>
						</Card>
					</nav>
				) : null}
			</div>

			{start.length > 0 ? (
				<section data-docs-home="start" aria-labelledby="docs-home-start">
					<div className="mb-6 flex flex-col gap-1">
						<h2 id="docs-home-start" className={SECTION_TITLE}>
							{t("start.title")}
						</h2>
						<p className="text-muted-foreground text-sm">
							{t("start.description")}
						</p>
					</div>
					<ol className={cn("grid gap-4", START_GRID[start.length])}>
						{start.map((page, index) => (
							<li key={page.url} className="flex">
								<NextLink
									href={page.url}
									className={cn("group flex w-full rounded-2xl", FOCUS)}
								>
									<Card className="w-full gap-3 p-6 transition-shadow group-hover:shadow-md">
										<span
											aria-hidden="true"
											className="font-extrabold font-heading text-3xl tabular-nums leading-none"
										>
											{String(index + 1).padStart(2, "0")}
										</span>
										<span className="font-bold font-heading text-base leading-6">
											{page.name}
										</span>
										{page.description ? (
											<span className="text-muted-foreground text-sm leading-6">
												{page.description}
											</span>
										) : null}
										<ArrowRight
											aria-hidden="true"
											className={cn(ARROW, "mt-auto")}
										/>
									</Card>
								</NextLink>
							</li>
						))}
					</ol>
				</section>
			) : null}

			{rest.length > 0 ? (
				<section
					data-docs-home="topics"
					aria-labelledby="docs-home-topics"
					className="mt-16"
				>
					<h2 id="docs-home-topics" className={cn(SECTION_TITLE, "mb-6")}>
						{t("topics.title")}
					</h2>
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{rest.map((section) => {
							const more = section.pageCount - TOPIC_PAGES;
							return (
								<li key={section.key} className="flex">
									<Card className="w-full gap-3 p-6">
										<h3 className="flex items-center gap-2.5 font-bold font-heading text-base leading-6 [&_svg]:size-5 [&_svg]:text-muted-foreground">
											{section.icon}
											{section.name}
										</h3>
										<ul className="-mx-3 flex flex-col">
											{section.pages.slice(0, TOPIC_PAGES).map((page) => (
												<li key={page.url}>
													<NextLink
														href={page.url}
														className={cn(
															"group flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-sm transition-colors hover:bg-muted",
															FOCUS,
														)}
													>
														<span className="flex-1 truncate">{page.name}</span>
														<ArrowRight aria-hidden="true" className={ARROW} />
													</NextLink>
												</li>
											))}
										</ul>
										{more > 0 ? (
											<NextLink
												href={section.href}
												className={cn(
													"mt-auto self-start rounded-sm font-semibold text-sm hover:underline",
													FOCUS,
												)}
											>
												{t("topics.more", { count: more })}
											</NextLink>
										) : null}
									</Card>
								</li>
							);
						})}
					</ul>
				</section>
			) : null}
		</div>
	);
}
