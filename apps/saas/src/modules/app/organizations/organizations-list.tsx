"use client";

import { authClient } from "@fuutu/auth/client";
import {
	Button,
	Card,
	CardContent,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import { slugify } from "@fuutu/utils";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type Org = {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
};

export function OrganizationsList() {
	const t = useTranslations();
	const router = useRouter();
	const [orgs, setOrgs] = useState<Org[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.organization.list();
			setOrgs((res.data ?? []) as Org[]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function create(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setIsLoading(true);
		const slug = slugify(name);
		try {
			const slugRes = await authClient.organization.checkSlug({ slug });
			if (slugRes.error || slugRes.data?.status === false) {
				setError(t("organizations.list.slugTaken"));
				return;
			}
			const res = await authClient.organization.create({ name, slug });
			if (res.error) {
				setError(t("organizations.list.failed"));
				return;
			}
			setName("");
			setCreating(false);
			await load();
			router.push(`/organizations/${slug}`);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">
						{t("organizations.list.title")}
					</h1>
					<p className="mt-2 text-muted-foreground">
						{t("organizations.list.description")}
					</p>
				</div>
				<Button onClick={() => setCreating((v) => !v)}>
					<Plus className="mr-2 size-4" />
					{t("organizations.list.create")}
				</Button>
			</div>

			{creating && (
				<Card>
					<CardContent className="p-6">
						<form onSubmit={create}>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="org-name">
										{t("organizations.list.name")}
									</FieldLabel>
									<Input
										id="org-name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder={t("organizations.list.namePlaceholder")}
										required
									/>
								</Field>
								{error && (
									<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
										{error}
									</div>
								)}
								<div className="flex gap-3">
									<Button type="submit" disabled={isLoading || !name.trim()}>
										{isLoading
											? t("organizations.list.submitting")
											: t("organizations.list.submit")}
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => setCreating(false)}
									>
										{t("common.cancel")}
									</Button>
								</div>
							</FieldGroup>
						</form>
					</CardContent>
				</Card>
			)}

			{loading ? (
				<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
			) : orgs.length === 0 ? (
				<Card>
					<CardContent className="p-10 text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
							<Building2 className="size-5 text-muted-foreground" />
						</div>
						<h3 className="font-semibold">{t("organizations.list.empty")}</h3>
						<p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
							{t("organizations.list.emptyDescription")}
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{orgs.map((org) => (
						<Link
							key={org.id}
							href={`/organizations/${org.slug}`}
							className="group rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
						>
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<Building2 className="size-5" />
								</div>
								<div className="min-w-0">
									<p className="truncate font-semibold">{org.name}</p>
									<p className="truncate text-muted-foreground text-xs">
										/{org.slug}
									</p>
								</div>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
