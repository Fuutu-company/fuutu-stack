"use client";

import {
	Avatar,
	AvatarFallback,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	Progress,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@fuutu/ui";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

const MEMBERS = [
	{ key: "one", role: "owner" },
	{ key: "two", role: "admin" },
	{ key: "three", role: "member" },
] as const;

const SEATS = { used: 5, total: 5 } as const;

/** One realistic screen assembled only from tokens and `@fuutu/ui`. */
export function ExampleScreen() {
	const t = useTranslations("designSystem.example");

	return (
		<Card className="mx-auto w-full max-w-3xl">
			<CardHeader className="gap-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex items-center gap-3">
						<Avatar className="size-11 rounded-lg">
							<AvatarFallback className="rounded-lg bg-primary font-semibold text-primary-foreground">
								{t("orgName").slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="space-y-0.5">
							<CardTitle className="font-bold text-xl tracking-tight">
								{t("heading")}
							</CardTitle>
							<CardDescription>{t("subheading")}</CardDescription>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex -space-x-2">
							{MEMBERS.map(({ key }) => (
								<Avatar key={key} className="size-8 border-2 border-card">
									<AvatarFallback className="text-xs">
										{t(`members.items.${key}.initials`)}
									</AvatarFallback>
								</Avatar>
							))}
						</div>
						<Badge variant="secondary">{t("plan")}</Badge>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				<div className="flex items-start gap-2.5 rounded-lg border bg-warning px-4 py-3 text-sm text-warning-foreground">
					<TriangleAlert
						aria-hidden="true"
						className="mt-0.5 size-4 shrink-0"
					/>
					<p>{t("callout")}</p>
				</div>

				<Tabs defaultValue="general" className="gap-6">
					<TabsList aria-label={t("tabs.label")}>
						<TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
						<TabsTrigger value="members">{t("tabs.members")}</TabsTrigger>
						<TabsTrigger value="billing">{t("tabs.billing")}</TabsTrigger>
					</TabsList>

					<TabsContent value="general" className="mt-6">
						<FieldGroup className="max-w-xl">
							<Field>
								<FieldLabel htmlFor="design-org-name">
									{t("general.nameLabel")}
								</FieldLabel>
								<Input
									id="design-org-name"
									defaultValue={t("general.nameValue")}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="design-org-slug">
									{t("general.slugLabel")}
								</FieldLabel>
								<Input
									id="design-org-slug"
									defaultValue={t("general.slugValue")}
									aria-describedby="design-org-slug-hint"
								/>
								<FieldDescription id="design-org-slug-hint">
									{t("general.slugHint")}
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor="design-org-role">
									{t("general.roleLabel")}
								</FieldLabel>
								<Select defaultValue="member">
									<SelectTrigger id="design-org-role" className="w-full">
										<SelectValue placeholder={t("general.rolePlaceholder")} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="admin">
											{t("general.roles.admin")}
										</SelectItem>
										<SelectItem value="member">
											{t("general.roles.member")}
										</SelectItem>
										<SelectItem value="viewer">
											{t("general.roles.viewer")}
										</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field orientation="horizontal">
								<FieldContent>
									<FieldLabel htmlFor="design-org-2fa">
										{t("general.twoFactorLabel")}
									</FieldLabel>
									<FieldDescription>
										{t("general.twoFactorHint")}
									</FieldDescription>
								</FieldContent>
								<Switch id="design-org-2fa" defaultChecked />
							</Field>
							<Field orientation="horizontal">
								<FieldContent>
									<FieldLabel htmlFor="design-org-invite">
										{t("general.inviteLabel")}
									</FieldLabel>
									<FieldDescription>{t("general.inviteHint")}</FieldDescription>
								</FieldContent>
								<Switch id="design-org-invite" />
							</Field>
						</FieldGroup>
					</TabsContent>

					<TabsContent value="members" className="mt-6">
						<ul className="divide-y rounded-lg border">
							{MEMBERS.map(({ key, role }) => (
								<li key={key} className="flex items-center gap-3 px-4 py-3">
									<Avatar className="size-9">
										<AvatarFallback className="text-xs">
											{t(`members.items.${key}.initials`)}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">
											{t(`members.items.${key}.name`)}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{t(`members.items.${key}.email`)}
										</p>
									</div>
									<Badge variant={role === "owner" ? "default" : "outline"}>
										{t(`members.${role}`)}
									</Badge>
								</li>
							))}
						</ul>
					</TabsContent>

					<TabsContent value="billing" className="mt-6">
						<div className="max-w-xl space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="font-medium">{t("billing.seats")}</span>
								<span className="text-muted-foreground tabular-nums">
									{t("billing.usage", SEATS)}
								</span>
							</div>
							<Progress
								value={(SEATS.used / SEATS.total) * 100}
								aria-label={t("billing.seats")}
							/>
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>

			<CardFooter className="justify-end gap-2 border-t">
				<Button variant="outline">{t("cancel")}</Button>
				<Button>{t("save")}</Button>
			</CardFooter>
		</Card>
	);
}
