"use client";

import { createLogger } from "@fuutu/logs";
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Switch,
} from "@fuutu/ui";
import { WEBHOOK_EVENTS, type WebhookEventType } from "@fuutu/webhooks/events";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { planGateMessage } from "@/lib/api-error";
import { orpc } from "@/utils/orpc";

type Webhook = {
	id: string;
	url: string;
	events: string[];
	isActive: boolean;
};

const log = createLogger({ scope: "webhooks" });

export function WebhookEditDialog({
	webhook,
	organizationId,
	onUpdated,
}: {
	webhook: Webhook;
	organizationId: string;
	onUpdated: () => void;
}) {
	const t = useTranslations("webhooks");
	const tRoot = useTranslations();
	const tCommon = useTranslations("common");
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState(webhook.url);
	// Stored rows may carry event names removed from the catalog — the API
	// only accepts WEBHOOK_EVENTS values, so anything stale is dropped here.
	const [events, setEvents] = useState<WebhookEventType[]>(
		webhook.events.filter((e): e is WebhookEventType =>
			(WEBHOOK_EVENTS as readonly string[]).includes(e),
		),
	);
	const [isActive, setIsActive] = useState(webhook.isActive);
	const [saving, setSaving] = useState(false);

	function toggleEvent(event: WebhookEventType) {
		setEvents((prev) =>
			prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
		);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			await orpc.webhooks.update.call({
				id: webhook.id,
				organizationId,
				url,
				events,
				isActive,
			});
			setOpen(false);
			onUpdated();
		} catch (e) {
			log.error("webhook update failed", { err: e });
			toast.error(planGateMessage(e, tRoot, "webhooks.updateError"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm" aria-label={t("edit")}>
					<Pencil className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md" closeLabel={tCommon("close")}>
				<form onSubmit={submit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>{t("editDialog.title")}</DialogTitle>
						<DialogDescription>{t("editDialog.description")}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="edit-webhook-url">
							{t("editDialog.urlLabel")}
						</FieldLabel>
						<Input
							id="edit-webhook-url"
							type="url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							required
						/>
					</Field>
					<Field>
						<FieldLabel>{t("editDialog.eventsLabel")}</FieldLabel>
						<FieldGroup className="grid grid-cols-2 gap-2">
							{WEBHOOK_EVENTS.map((event) => (
								<div key={event} className="flex items-center gap-2 text-sm">
									<Checkbox
										id={`evt-edit-${event}`}
										checked={events.includes(event)}
										onCheckedChange={() => toggleEvent(event)}
									/>
									<label htmlFor={`evt-edit-${event}`}>
										{t(`events.${event}`)}
									</label>
								</div>
							))}
						</FieldGroup>
					</Field>
					<Field>
						<div className="flex items-center gap-2 text-sm">
							<Switch
								id="webhook-active"
								checked={isActive}
								onCheckedChange={setIsActive}
							/>
							<label htmlFor="webhook-active">
								{t("editDialog.activeLabel")}
							</label>
						</div>
					</Field>
					<DialogFooter>
						<Button
							type="submit"
							disabled={saving || !url.trim() || events.length === 0}
						>
							{saving ? t("editDialog.saving") : t("editDialog.submit")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
