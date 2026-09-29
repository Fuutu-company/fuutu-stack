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
	FieldError,
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
import { z } from "zod";

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

// Mirrors createContactSchema in @fuutu/api (packages/api/src/modules/crm).
// Every rule's error message is a key in the `crm` translation namespace —
// `t(issue.message)` below resolves it, so no default Zod message may leak.
const contactFormSchema = z.object({
	name: z.string().min(1, "nameRequired").max(200, "fieldTooLong"),
	email: z.string().email("emailInvalid"),
	company: z.string().max(200, "fieldTooLong"),
	phone: z.string().max(50, "fieldTooLong"),
	status: z.enum(["lead", "qualified", "proposal", "won", "lost"], {
		error: "statusInvalid",
	}),
	notes: z.string().max(5000, "fieldTooLong"),
});

type FieldErrors = Partial<Record<keyof ContactFormValues, string>>;

export function ContactForm({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	isSubmitting,
}: ContactFormProps) {
	const t = useTranslations("crm");
	const tCommon = useTranslations("common");
	const [values, setValues] = useState<ContactFormValues>(EMPTY_VALUES);
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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
			setFieldErrors({});
		}
	}, [open, initialValues]);

	function update<K extends keyof ContactFormValues>(
		field: K,
		value: ContactFormValues[K],
	) {
		setValues((prev) => ({ ...prev, [field]: value }));
		setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const parsed = contactFormSchema.safeParse(values);
		if (!parsed.success) {
			const errors: FieldErrors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0] as keyof ContactFormValues;
				if (!errors[field]) {
					errors[field] = t(issue.message);
				}
			}
			setFieldErrors(errors);
			return;
		}
		onSubmit(values);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg" closeLabel={tCommon("close")}>
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
				<form onSubmit={handleSubmit} className="space-y-4" noValidate>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="contact-name">{t("fullName")}</FieldLabel>
							<Input
								id="contact-name"
								value={values.name}
								onChange={(e) => update("name", e.target.value)}
								placeholder={t("namePlaceholder")}
								aria-invalid={!!fieldErrors.name}
								required
							/>
							<FieldError
								errors={fieldErrors.name ? [{ message: fieldErrors.name }] : []}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-email">{t("email")}</FieldLabel>
							<Input
								id="contact-email"
								type="email"
								value={values.email}
								onChange={(e) => update("email", e.target.value)}
								placeholder={t("emailPlaceholder")}
								aria-invalid={!!fieldErrors.email}
								required
							/>
							<FieldError
								errors={
									fieldErrors.email ? [{ message: fieldErrors.email }] : []
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-company">{t("company")}</FieldLabel>
							<Input
								id="contact-company"
								value={values.company}
								onChange={(e) => update("company", e.target.value)}
								placeholder={t("companyPlaceholder")}
								aria-invalid={!!fieldErrors.company}
							/>
							<FieldError
								errors={
									fieldErrors.company ? [{ message: fieldErrors.company }] : []
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-phone">{t("phone")}</FieldLabel>
							<Input
								id="contact-phone"
								value={values.phone}
								onChange={(e) => update("phone", e.target.value)}
								placeholder={t("phonePlaceholder")}
								aria-invalid={!!fieldErrors.phone}
							/>
							<FieldError
								errors={
									fieldErrors.phone ? [{ message: fieldErrors.phone }] : []
								}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="contact-status">{t("status")}</FieldLabel>
							<Select
								value={values.status}
								onValueChange={(value) => update("status", value)}
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
								onChange={(e) => update("notes", e.target.value)}
								placeholder={t("notesPlaceholder")}
								aria-invalid={!!fieldErrors.notes}
								rows={3}
							/>
							<FieldError
								errors={
									fieldErrors.notes ? [{ message: fieldErrors.notes }] : []
								}
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
