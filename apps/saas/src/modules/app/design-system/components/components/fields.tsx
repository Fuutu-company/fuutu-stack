import {
	Checkbox,
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
	Input,
	Label,
	Switch,
} from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

function Sample({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
			<p className="text-muted-foreground text-xs">{label}</p>
			{children}
		</div>
	);
}

export async function Fields() {
	const t = await getTranslations("designSystem.components.fields");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<div className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<Sample label={t("typical.name")}>
						<Field>
							<FieldLabel htmlFor="design-field-typical">
								{t("typical.label")}
							</FieldLabel>
							<Input
								id="design-field-typical"
								placeholder={t("typical.placeholder")}
							/>
						</Field>
					</Sample>
					<Sample label={t("described.name")}>
						<Field>
							<FieldLabel htmlFor="design-field-described">
								{t("described.label")}
							</FieldLabel>
							<Input
								id="design-field-described"
								defaultValue={t("described.value")}
								aria-describedby="design-field-described-hint"
							/>
							<FieldDescription id="design-field-described-hint">
								{t("described.hint")}
							</FieldDescription>
						</Field>
					</Sample>
					<Sample label={t("error.name")}>
						<Field data-invalid>
							<FieldLabel htmlFor="design-field-error">
								{t("error.label")}
							</FieldLabel>
							<Input
								id="design-field-error"
								className="text-foreground"
								defaultValue={t("error.value")}
								aria-invalid
								aria-describedby="design-field-error-message"
							/>
							<FieldError id="design-field-error-message">
								{t("error.message")}
							</FieldError>
						</Field>
					</Sample>
					<Sample label={t("disabled.name")}>
						<Field data-disabled>
							<FieldLabel htmlFor="design-field-disabled">
								{t("disabled.label")}
							</FieldLabel>
							<Input
								id="design-field-disabled"
								defaultValue={t("disabled.value")}
								disabled
							/>
						</Field>
					</Sample>
				</div>

				<div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
					<FieldSet>
						<FieldLegend>{t("group.legend")}</FieldLegend>
						<FieldDescription>{t("group.description")}</FieldDescription>
						<FieldGroup className="gap-4">
							<Field orientation="horizontal">
								<Checkbox id="design-field-invites" defaultChecked />
								<FieldLabel
									htmlFor="design-field-invites"
									className="font-normal"
								>
									{t("group.invites")}
								</FieldLabel>
							</Field>
							<Field orientation="horizontal">
								<Checkbox id="design-field-billing" defaultChecked />
								<FieldLabel
									htmlFor="design-field-billing"
									className="font-normal"
								>
									{t("group.billing")}
								</FieldLabel>
							</Field>
							<FieldSeparator>{t("group.or")}</FieldSeparator>
							<Field orientation="horizontal">
								<FieldContent>
									<FieldTitle>{t("group.digestTitle")}</FieldTitle>
									<FieldDescription>{t("group.digestHint")}</FieldDescription>
								</FieldContent>
								<Switch aria-label={t("group.digestTitle")} />
							</Field>
							<div className="flex items-center gap-2">
								<Switch id="design-field-compact" />
								<Label htmlFor="design-field-compact">
									{t("group.compact")}
								</Label>
							</div>
						</FieldGroup>
					</FieldSet>
				</div>
			</div>
		</DesignSubsection>
	);
}
