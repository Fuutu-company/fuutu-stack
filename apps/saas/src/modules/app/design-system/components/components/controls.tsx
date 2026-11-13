import {
	Badge,
	Button,
	Checkbox,
	Input,
	RadioGroup,
	RadioGroupItem,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Slider,
	Switch,
	Textarea,
} from "@fuutu/ui";
import { ArrowRight, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";
import { OtpRow } from "./otp-row";
import { type MatrixRow, PreviewMatrix } from "./preview";
import { previewProps } from "./preview-state";

const BUTTON_VARIANTS = [
	"default",
	"secondary",
	"outline",
	"ghost",
	"destructive",
	"link",
] as const;

const BADGE_VARIANTS = [
	"default",
	"secondary",
	"outline",
	"destructive",
] as const;

const BUTTON_SIZES = [
	"xs",
	"sm",
	"default",
	"lg",
	"icon-xs",
	"icon-sm",
	"icon",
	"icon-lg",
] as const;

export async function Controls() {
	const t = await getTranslations("designSystem.components");

	const buttonRows: MatrixRow[] = BUTTON_VARIANTS.map((variant) => ({
		id: variant,
		label: variant,
		cell: (state) => (
			<Button variant={variant} {...previewProps(state)}>
				{t("button.label")}
			</Button>
		),
	}));

	const badgeRows: MatrixRow[] = BADGE_VARIANTS.map((variant) => ({
		id: variant,
		label: variant,
		// A badge is not interactive: hover, active and disabled do not apply.
		cell: (state) =>
			state === "default" || state === "focus" || state === "invalid" ? (
				<Badge variant={variant} {...previewProps(state)}>
					{t("badge.label")}
				</Badge>
			) : null,
	}));

	const formRows: MatrixRow[] = [
		{
			id: "input",
			label: "Input",
			cell: (state) => (
				<Input
					aria-label={t("input.aria")}
					defaultValue={t("input.value")}
					{...previewProps(state)}
				/>
			),
		},
		{
			id: "textarea",
			label: "Textarea",
			cell: (state) => (
				<Textarea
					rows={2}
					aria-label={t("textarea.aria")}
					defaultValue={t("textarea.value")}
					{...previewProps(state)}
				/>
			),
		},
		{
			id: "select",
			label: "Select",
			cell: (state) => {
				const { disabled, ...pinned } = previewProps(state);
				return (
					<Select defaultValue="member" disabled={disabled}>
						<SelectTrigger
							className="w-full"
							aria-label={t("select.aria")}
							{...pinned}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="member">{t("select.member")}</SelectItem>
							<SelectItem value="admin">{t("select.admin")}</SelectItem>
						</SelectContent>
					</Select>
				);
			},
		},
		{
			id: "checkbox",
			label: "Checkbox",
			cell: (state) => (
				<Checkbox aria-label={t("checkbox.aria")} {...previewProps(state)} />
			),
		},
		{
			id: "switch",
			label: "Switch",
			cell: (state) => (
				<Switch
					defaultChecked
					aria-label={t("switch.aria")}
					{...previewProps(state)}
				/>
			),
		},
		{
			id: "radio-group",
			label: "RadioGroup",
			cell: (state) => (
				<RadioGroup aria-label={t("radio.aria")}>
					<RadioGroupItem
						value="one"
						aria-label={t("radio.item")}
						{...previewProps(state)}
					/>
				</RadioGroup>
			),
		},
		{
			id: "slider",
			label: "Slider",
			// The thumb is its own focus target, so only the real states apply.
			cell: (state) =>
				state === "default" || state === "disabled" ? (
					<Slider
						defaultValue={[60]}
						max={100}
						thumbLabel={t("slider.aria")}
						disabled={state === "disabled"}
					/>
				) : null,
		},
	];

	return (
		<div className="space-y-14">
			<DesignSubsection
				title={t("button.title")}
				description={t.rich("button.description", richCode)}
			>
				<div className="space-y-4">
					<PreviewMatrix rows={buttonRows} />
					<div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
						<h4 className="font-medium text-sm">{t("button.sizes")}</h4>
						<div className="flex flex-wrap items-end gap-4">
							{BUTTON_SIZES.map((size) => (
								<div key={size} className="flex flex-col items-start gap-2">
									{size.startsWith("icon") ? (
										<Button
											size={size}
											variant="outline"
											aria-label={t("button.iconLabel")}
										>
											<Plus />
										</Button>
									) : (
										<Button size={size}>
											{t("button.label")}
											{size === "lg" ? <ArrowRight /> : null}
										</Button>
									)}
									<code className="font-mono text-muted-foreground text-xs">
										{size}
									</code>
								</div>
							))}
						</div>
					</div>
				</div>
			</DesignSubsection>

			<DesignSubsection
				title={t("badge.title")}
				description={t.rich("badge.description", richCode)}
			>
				<PreviewMatrix rows={badgeRows} />
			</DesignSubsection>

			<DesignSubsection
				title={t("form.title")}
				description={t.rich("form.description", richCode)}
			>
				<div className="space-y-4">
					<PreviewMatrix rows={formRows} />
					<OtpRow />
				</div>
			</DesignSubsection>
		</div>
	);
}
