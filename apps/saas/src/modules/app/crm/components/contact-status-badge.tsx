"use client";

import { createLogger } from "@fuutu/logs";
import { Badge } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { z } from "zod";

const log = createLogger({ scope: "crm" });

export const contactStatusSchema = z.enum([
	"lead",
	"qualified",
	"proposal",
	"won",
	"lost",
]);

export type ContactStatus = z.infer<typeof contactStatusSchema>;

const STATUS_LABELS: Record<ContactStatus, string> = {
	lead: "statusLead",
	qualified: "statusQualified",
	proposal: "statusProposal",
	won: "statusWon",
	lost: "statusLost",
};

const STATUS_VARIANTS: Record<
	ContactStatus,
	{
		className: string;
		variant: "default" | "secondary" | "destructive";
	}
> = {
	lead: {
		className: "border-primary/30 bg-primary/10 text-primary",
		variant: "secondary",
	},
	qualified: {
		className: "border-border bg-secondary text-secondary-foreground",
		variant: "secondary",
	},
	proposal: {
		className: "border-border bg-muted text-muted-foreground",
		variant: "secondary",
	},
	won: {
		className: "border-success/30 bg-success/10 text-success",
		variant: "default",
	},
	lost: {
		className: "border-destructive/30 bg-destructive/10 text-destructive",
		variant: "destructive",
	},
};

type ContactStatusBadgeProps = {
	status: string;
};

export function ContactStatusBadge({ status }: ContactStatusBadgeProps) {
	const t = useTranslations("crm");
	const parsed = contactStatusSchema.safeParse(status);
	const statusKey: ContactStatus = parsed.success ? parsed.data : "lead";
	if (!parsed.success) {
		log.warn("unknown contact status", { status });
	}
	const config = STATUS_VARIANTS[statusKey];

	return (
		<Badge variant={config.variant} className={config.className}>
			{t(STATUS_LABELS[statusKey])}
		</Badge>
	);
}
