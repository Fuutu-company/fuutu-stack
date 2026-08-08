"use client";

import {
	Button,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type ContactFormValues = {
	name: string;
	email: string;
	company: string;
	phone: string;
	status: string;
	notes: string;
};

type ContactFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialValues?: Partial<ContactFormValues> | null;
	onSubmit: (values: ContactFormValues) => void;
	isSubmitting: boolean;
};

const EMPTY_VALUES: ContactFormValues = {
	name: "",
	email: "",
	company: "",
	phone: "",
	status: "lead",
	notes: "",
};

export function ContactForm({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	isSubmitting,
}: ContactFormProps) {
	const t = useTranslations("crm");
	const [values, setValues] = useState<ContactFormValues>(EMPTY_VALUES);

	useEffect(() => {
		if (open) {
			setValues({
				name: initialValues?.name ?? "",
				email: initialValues?.email ?? "",
				company: initialValues?.company ?? "",
				phone: initialValues?.phone ?? "",
				status: initialValues?.status ?? "lead",
				notes: initialValues?.notes ?? "",
			});
		}
	}, [open, initialValues]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		onSubmit(values);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{initialValues ? t("editContact") : t("newContact")}
					</DialogTitle>
					<DialogDescription className="sr-only">
						{initialValues
							? t("editContactDescription")
							: t("newContactDescription")}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="contact-name">{t("fullName")}</FieldLabel>
							<Input
								id="contact-name"
								value={values.name}
								onChange={(e) =>
									setValues((prev) => ({ ...prev, name: e.target.value }))
								}
								placeholder={t("namePlaceholder")}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-email">{t("email")}</FieldLabel>
							<Input
								id="contact-email"
								type="email"
								value={values.email}
								onChange={(e) =>
									setValues((prev) => ({ ...prev, email: e.target.value }))
								}
								placeholder={t("emailPlaceholder")}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-company">{t("company")}</FieldLabel>
							<Input
								id="contact-company"
								value={values.company}
								onChange={(e) =>
									setValues((prev) => ({ ...prev, company: e.target.value }))
								}
								placeholder={t("companyPlaceholder")}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-phone">{t("phone")}</FieldLabel>
							<Input
								id="contact-phone"
								value={values.phone}
								onChange={(e) =>
									setValues((prev) => ({ ...prev, phone: e.target.value }))
								}
								placeholder={t("phonePlaceholder")}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-status">{t("status")}</FieldLabel>
							<Select
								value={values.status}
								onValueChange={(value) =>
									setValues((prev) => ({ ...prev, status: value }))
								}
							>
								<SelectTrigger id="contact-status">
									<SelectValue placeholder={t("selectStatus")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="lead">{t("statusLead")}</SelectItem>
									<SelectItem value="qualified">
										{t("statusQualified")}
									</SelectItem>
									<SelectItem value="proposal">
										{t("statusProposal")}
									</SelectItem>
									<SelectItem value="won">{t("statusWon")}</SelectItem>
									<SelectItem value="lost">{t("statusLost")}</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-notes">{t("notes")}</FieldLabel>
							<Textarea
								id="contact-notes"
								value={values.notes}
								onChange={(e) =>
									setValues((prev) => ({ ...prev, notes: e.target.value }))
								}
								placeholder={t("notesPlaceholder")}
								rows={3}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								{t("cancel")}
							</Button>
						</DialogClose>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting
								? initialValues
									? t("saving")
									: t("creating")
								: t("save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
