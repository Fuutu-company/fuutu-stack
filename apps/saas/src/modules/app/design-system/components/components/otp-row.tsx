"use client";

import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { type PREVIEW_STATES, previewProps } from "./preview-state";

const OTP_STATES = [
	"default",
	"invalid",
	"disabled",
] as const satisfies readonly (typeof PREVIEW_STATES)[number][];

function OtpExample({ state }: { state: (typeof OTP_STATES)[number] }) {
	const t = useTranslations("designSystem.components");
	const [value, setValue] = useState("482");
	const { disabled, "aria-invalid": invalid } = previewProps(state);

	return (
		<div className="flex flex-col items-start gap-2">
			<InputOTP
				maxLength={6}
				value={value}
				onChange={setValue}
				disabled={disabled}
				aria-label={t("otp.aria")}
			>
				<InputOTPGroup>
					<InputOTPSlot index={0} aria-invalid={invalid} />
					<InputOTPSlot index={1} aria-invalid={invalid} />
					<InputOTPSlot index={2} aria-invalid={invalid} />
				</InputOTPGroup>
				<InputOTPSeparator />
				<InputOTPGroup>
					<InputOTPSlot index={3} aria-invalid={invalid} />
					<InputOTPSlot index={4} aria-invalid={invalid} />
					<InputOTPSlot index={5} aria-invalid={invalid} />
				</InputOTPGroup>
			</InputOTP>
			<span className="text-muted-foreground text-xs">
				{t(`matrix.states.${state}`)}
			</span>
		</div>
	);
}

export function OtpRow() {
	const t = useTranslations("designSystem.components");

	return (
		<div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
			<h4 className="font-medium text-sm">{t("otp.title")}</h4>
			<div className="flex flex-wrap gap-x-8 gap-y-4">
				{OTP_STATES.map((state) => (
					<OtpExample key={state} state={state} />
				))}
			</div>
		</div>
	);
}
