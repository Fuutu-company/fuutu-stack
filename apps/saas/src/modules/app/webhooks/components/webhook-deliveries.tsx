"use client";

import { Badge, Button, Card, CardContent } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

type Delivery = {
	id: string;
	eventType: string;
	status: string;
	responseCode: number | null;
	attemptedAt: Date;
};

export function WebhookDeliveries({
	webhookId,
	organizationId,
}: {
	webhookId: string;
	organizationId: string;
}) {
	const t = useTranslations("webhooks");
	const tCommon = useTranslations("common");
	const locale = useLocale();
	const [expanded, setExpanded] = useState(false);

	const query = useQuery(
		orpc.webhooks.deliveries.list.queryOptions({
			input: { webhookId, organizationId, page: 1, limit: 10 },
			enabled: expanded,
		}),
	);

	const deliveries = (query.data?.items ?? []) as Delivery[];

	return (
		<div className="space-y-2">
			<Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
				{expanded ? (
					<ChevronDown className="size-4" />
				) : (
					<ChevronRight className="size-4" />
				)}
				{expanded ? t("deliveries.hide") : t("deliveries.show")}
			</Button>
			{expanded && (
				<Card>
					<CardContent className="p-0">
						{query.isLoading ? (
							<p className="p-4 text-muted-foreground text-sm">
								{t("loading")}
							</p>
						) : query.isError ? (
							<p className="p-4 text-destructive text-sm">{t("failed")}</p>
						) : deliveries.length === 0 ? (
							<p className="p-4 text-muted-foreground text-sm">
								{t("deliveries.empty")}
							</p>
						) : (
							<div className="overflow-hidden rounded-lg border">
								<table className="w-full text-sm">
									<thead className="bg-muted/50">
										<tr className="text-left">
											<th className="p-3 font-medium">
												{t("deliveries.col.event")}
											</th>
											<th className="p-3 font-medium">
												{t("deliveries.col.status")}
											</th>
											<th className="p-3 font-medium">
												{t("deliveries.col.responseCode")}
											</th>
											<th className="p-3 font-medium">
												{t("deliveries.col.timestamp")}
											</th>
										</tr>
									</thead>
									<tbody className="divide-y">
										{deliveries.map((delivery) => (
											<tr key={delivery.id}>
												<td className="p-3 font-mono text-xs">
													{delivery.eventType}
												</td>
												<td className="p-3">
													<Badge
														variant={
															delivery.status === "success"
																? "default"
																: "secondary"
														}
													>
														{t(`deliveries.status.${delivery.status}`)}
													</Badge>
												</td>
												<td className="p-3 text-muted-foreground text-xs">
													{delivery.responseCode ?? tCommon("notAvailable")}
												</td>
												<td className="p-3 text-muted-foreground text-xs">
													{delivery.attemptedAt.toLocaleString(locale)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
