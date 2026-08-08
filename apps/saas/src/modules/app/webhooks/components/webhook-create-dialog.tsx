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
} from "@fuutu/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { WEBHOOK_EVENTS } from "../constants";

const log = createLogger({ scope: "webhook-create-dialog" });

type CreatedWebhook = {
	id: string;
	url: string;
	events: string[];
	secret: string;
	isActive: boolean;
	createdAt: Date;
};

export function WebhookCreateDialog({
	organizationId,
	onCreated,
}: {
	organizationId: string;
	onCreated: (webhook: CreatedWebhook) => void;
}) {
	const t = useTranslations("webhooks");
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState("");
	const [events, setEvents] = useState<string[]>([]);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function toggleEvent(event: string) {
		setEvents((prev) =>
			prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
		);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setCreating(true);
		setError(null);
		try {
			const result = await orpc.webhooks.create.call({
				organizationId,
				url,
				events,
			});
			setOpen(false);
			setUrl("");
			setEvents([]);
			onCreated(result as CreatedWebhook);
		} catch (err) {
			log.error("create failed", { err });
			setError(t("failed"));
		} finally {
			setCreating(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="size-4" />
					{t("create")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={submit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>{t("createDialog.title")}</DialogTitle>
						<DialogDescription>
							{t("createDialog.description")}
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="webhook-url">
							{t("createDialog.urlLabel")}
						</FieldLabel>
						<Input
							id="webhook-url"
							type="url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder={t("createDialog.urlPlaceholder")}
							required
						/>
					</Field>
					<Field>
						<FieldLabel>{t("createDialog.eventsLabel")}</FieldLabel>
						<FieldGroup className="grid grid-cols-2 gap-2">
							{WEBHOOK_EVENTS.map((event) => (
								<div key={event} className="flex items-center gap-2 text-sm">
									<Checkbox
										id={`evt-${event}`}
										checked={events.includes(event)}
										onCheckedChange={() => toggleEvent(event)}
									/>
									<label htmlFor={`evt-${event}`}>{t(`events.${event}`)}</label>
								</div>
							))}
						</FieldGroup>
					</Field>
					{error && <p className="text-destructive text-sm">{error}</p>}
					<DialogFooter>
						<Button
							type="submit"
							disabled={creating || !url.trim() || events.length === 0}
						>
							{creating ? t("creating") : t("createDialog.submit")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
