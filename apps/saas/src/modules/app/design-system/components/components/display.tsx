import {
	Alert,
	AlertDescription,
	AlertTitle,
	Avatar,
	AvatarFallback,
	AvatarImage,
	BrandLogo,
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Progress,
	Separator,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@fuutu/ui";
import { ChevronsUpDown, CircleAlert, Info } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

const LOGO_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
const PROGRESS_VALUES = [25, 66, 100] as const;

function Showcase({ title, children }: { title: string; children: ReactNode }) {
	return (
		<li className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
			<h4 className="font-medium text-sm">{title}</h4>
			<div className="flex flex-1 flex-col justify-start gap-3">{children}</div>
		</li>
	);
}

export async function Display() {
	const t = await getTranslations("designSystem.components.display");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				<Showcase title="Tabs">
					<Tabs defaultValue="overview">
						<TabsList>
							<TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
							<TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
							<TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
						</TabsList>
						<TabsContent
							value="overview"
							className="text-muted-foreground text-sm"
						>
							{t("tabs.overviewBody")}
						</TabsContent>
						<TabsContent
							value="activity"
							className="text-muted-foreground text-sm"
						>
							{t("tabs.activityBody")}
						</TabsContent>
						<TabsContent
							value="settings"
							className="text-muted-foreground text-sm"
						>
							{t("tabs.settingsBody")}
						</TabsContent>
					</Tabs>
				</Showcase>

				<Showcase title="Breadcrumb">
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/dashboard">
									{t("breadcrumb.home")}
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbEllipsis aria-label={t("breadcrumb.more")} />
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbLink href="/organizations">
									{t("breadcrumb.organizations")}
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>{t("breadcrumb.current")}</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</Showcase>

				<Showcase title="Alert">
					<Alert>
						<Info />
						<AlertTitle>{t("alert.title")}</AlertTitle>
						<AlertDescription>{t("alert.body")}</AlertDescription>
					</Alert>
					<Alert variant="destructive">
						<CircleAlert />
						<AlertTitle>{t("alert.errorTitle")}</AlertTitle>
						<AlertDescription>{t("alert.errorBody")}</AlertDescription>
					</Alert>
				</Showcase>

				<Showcase title="Card">
					<Card className="gap-4 py-4 shadow-xs">
						<CardHeader>
							<CardTitle>{t("card.title")}</CardTitle>
							<CardDescription>{t("card.description")}</CardDescription>
							<CardAction>
								<Button size="sm" variant="outline">
									{t("card.action")}
								</Button>
							</CardAction>
						</CardHeader>
						<CardContent className="text-sm">{t("card.body")}</CardContent>
						<CardFooter className="text-muted-foreground text-xs">
							{t("card.footer")}
						</CardFooter>
					</Card>
				</Showcase>

				<Showcase title="Avatar">
					<div className="flex items-center gap-3">
						<Avatar>
							<AvatarImage
								src="/logo.svg"
								alt={t("avatar.alt")}
								className="dark:invert"
							/>
							<AvatarFallback>{t("avatar.fallback")}</AvatarFallback>
						</Avatar>
						<Avatar>
							<AvatarFallback>{t("avatar.initials")}</AvatarFallback>
						</Avatar>
						<Avatar className="size-12">
							<AvatarFallback>{t("avatar.initialsLarge")}</AvatarFallback>
						</Avatar>
					</div>
				</Showcase>

				<Showcase title="Progress">
					{PROGRESS_VALUES.map((value) => (
						<Progress
							key={value}
							value={value}
							aria-label={t("progress.label", { value })}
						/>
					))}
				</Showcase>

				<Showcase title="Skeleton">
					<div className="flex items-center gap-3">
						<Skeleton className="size-10 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-3.5 w-3/4" />
							<Skeleton className="h-3.5 w-1/2" />
						</div>
					</div>
				</Showcase>

				<Showcase title="Separator">
					<div className="flex h-5 items-center gap-3 text-sm">
						<span>{t("separator.docs")}</span>
						<Separator orientation="vertical" />
						<span>{t("separator.source")}</span>
						<Separator orientation="vertical" />
						<span>{t("separator.support")}</span>
					</div>
					<Separator />
					<p className="text-muted-foreground text-xs">{t("separator.note")}</p>
				</Showcase>

				<Showcase title="Collapsible">
					<Collapsible className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<span className="font-medium text-sm">
								{t("collapsible.title")}
							</span>
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="icon-sm">
									<ChevronsUpDown />
									<span className="sr-only">{t("collapsible.toggle")}</span>
								</Button>
							</CollapsibleTrigger>
						</div>
						<div className="rounded-md border px-3 py-2 text-sm">
							{t("collapsible.first")}
						</div>
						<CollapsibleContent className="space-y-2">
							<div className="rounded-md border px-3 py-2 text-sm">
								{t("collapsible.second")}
							</div>
						</CollapsibleContent>
					</Collapsible>
				</Showcase>

				<Showcase title="BrandLogo">
					<div className="flex flex-wrap items-end gap-4">
						{LOGO_SIZES.map((size) => (
							<div key={size} className="flex flex-col items-center gap-2">
								<BrandLogo size={size} className="dark:invert" />
								<code className="font-mono text-muted-foreground text-xs">
									{size}
								</code>
							</div>
						))}
					</div>
				</Showcase>
			</ul>
		</DesignSubsection>
	);
}
