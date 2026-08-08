"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { hasRoleAtLeast, toRbacRole } from "@fuutu/rbac";
import { Button, Card, CardContent, Input } from "@fuutu/ui";
import { Ban, Check, Search, Shield, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const log = createLogger({ scope: "admin-users" });

type AdminUser = {
	id: string;
	email: string;
	name?: string | null;
	role?: string | null;
	banned?: boolean | null;
	createdAt: string | Date;
};

export function AdminUsersTable() {
	const t = useTranslations();
	const locale = useLocale();
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.admin.listUsers({
				query: {
					limit: 100,
					searchField: "email",
					searchOperator: "contains",
					searchValue: search || undefined,
				},
			});
			const data = res.data as { users?: AdminUser[] } | null;
			setUsers(data?.users ?? []);
		} finally {
			setLoading(false);
		}
	}, [search]);

	useEffect(() => {
		void load();
	}, [load]);

	async function toggleBan(user: AdminUser) {
		setBusy(user.id);
		try {
			if (user.banned) {
				await authClient.admin.unbanUser({ userId: user.id });
			} else {
				await authClient.admin.banUser({
					userId: user.id,
					banReason: t("admin.users.defaultBanReason"),
				});
			}
			await load();
		} catch (e) {
			log.error("ban toggle failed", { err: e });
			toast.error(t("admin.users.banError"));
		} finally {
			setBusy(null);
		}
	}

	async function setRole(user: AdminUser, role: "admin" | "user") {
		setBusy(user.id);
		try {
			await authClient.admin.setRole({ userId: user.id, role });
			await load();
		} catch (e) {
			log.error("role change failed", { err: e });
			toast.error(t("admin.users.roleError"));
		} finally {
			setBusy(null);
		}
	}

	return (
		<Card>
			<CardContent className="space-y-4 p-6">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void load();
					}}
					className="flex gap-2"
				>
					<div className="relative flex-1">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("admin.users.searchPlaceholder")}
							className="pl-9"
						/>
					</div>
					<Button type="submit" variant="outline">
						{t("common.submit")}
					</Button>
				</form>

				{loading ? (
					<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
				) : users.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("admin.users.empty")}
					</p>
				) : (
					<div className="overflow-hidden rounded-lg border">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr className="text-left">
									<th className="p-3 font-medium">{t("admin.users.email")}</th>
									<th className="p-3 font-medium">{t("admin.users.role")}</th>
									<th className="p-3 font-medium">{t("admin.users.status")}</th>
									<th className="p-3 font-medium">
										{t("admin.users.createdAt")}
									</th>
									<th className="p-3 text-right font-medium">
										{t("admin.users.actions")}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{users.map((u) => {
									const rbacRole = toRbacRole(u.role);
									return (
										<tr key={u.id}>
											<td className="p-3">
												<div className="font-medium">
													{u.name ?? t("common.notAvailable")}
												</div>
												<div className="text-muted-foreground text-xs">
													{u.email}
												</div>
											</td>
											<td className="p-3">
												<span
													className={`rounded-full border px-2 py-0.5 font-medium text-xs ${
														hasRoleAtLeast(rbacRole, "admin")
															? "border-primary/30 bg-primary/10 text-primary"
															: "bg-muted text-muted-foreground"
													}`}
												>
													{t(`admin.users.roleValue.${u.role ?? "user"}`)}
												</span>
											</td>
											<td className="p-3">
												{u.banned ? (
													<span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
														{t("admin.users.banned")}
													</span>
												) : (
													<span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-medium text-success text-xs">
														{t("admin.users.active")}
													</span>
												)}
											</td>
											<td className="p-3 text-muted-foreground text-xs">
												{new Date(u.createdAt).toLocaleDateString(locale)}
											</td>
											<td className="p-3">
												<div className="flex justify-end gap-1">
													{hasRoleAtLeast(rbacRole, "admin") ? (
														<Button
															size="sm"
															variant="ghost"
															onClick={() => setRole(u, "user")}
															disabled={busy === u.id}
															aria-label={t("admin.users.makeUserAria")}
															title={t("admin.users.makeUser")}
														>
															<UserCheck className="size-4" />
														</Button>
													) : (
														<Button
															size="sm"
															variant="ghost"
															onClick={() => setRole(u, "admin")}
															disabled={busy === u.id}
															aria-label={t("admin.users.makeAdminAria")}
															title={t("admin.users.makeAdmin")}
														>
															<Shield className="size-4" />
														</Button>
													)}
													<Button
														size="sm"
														variant="ghost"
														onClick={() => toggleBan(u)}
														disabled={busy === u.id}
														aria-label={
															u.banned
																? t("admin.users.unbanAria")
																: t("admin.users.banAria")
														}
														title={
															u.banned
																? t("admin.users.unban")
																: t("admin.users.ban")
														}
													>
														{u.banned ? (
															<Check className="size-4 text-success" />
														) : (
															<Ban className="size-4 text-destructive" />
														)}
													</Button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
