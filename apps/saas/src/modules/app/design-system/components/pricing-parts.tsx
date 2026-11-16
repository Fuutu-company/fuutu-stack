"use client";

import { getShowcasePlan } from "@fuutu/payments/plans";
import { BillingToggle, SeatSelector } from "@fuutu/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

/** The two pricing controls on their own: billing interval and seat count. */
export function PricingParts() {
	const t = useTranslations("payments");
	const locale = useLocale();
	const [isYearly, setIsYearly] = useState(false);
	const [seatCount, setSeatCount] = useState(5);
	const showcase = getShowcasePlan();
	if (!showcase) return null;
	const { amount, currency, interval } = showcase.plan;

	const currencySymbol =
		new Intl.NumberFormat(locale, { style: "currency", currency })
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? currency;

	return (
		<div className="grid items-start gap-6 md:grid-cols-2">
			<div className="flex justify-center rounded-xl border bg-card px-4 pt-6 shadow-xs">
				<BillingToggle
					isYearly={isYearly}
					setIsYearly={setIsYearly}
					monthlyLabel={t("choosePlan.monthly")}
					yearlyLabel={t("choosePlan.yearly")}
					yearlyBadge={t("choosePlan.yearlyBadge")}
				/>
			</div>
			<SeatSelector
				className="min-w-0"
				seatCount={seatCount}
				onChange={setSeatCount}
				pricePerSeat={amount}
				currency={currency}
				currencySymbol={currencySymbol}
				locale={locale}
				interval={interval}
				translations={{
					title: t("seatSelector.title"),
					seat: t("seatSelector.seat"),
					seats: t("seatSelector.seats"),
					perMonth: t("seatSelector.perMonth"),
					perYear: t("seatSelector.perYear"),
					description: t("seatSelector.description"),
					decrease: t("seatSelector.decrease"),
					increase: t("seatSelector.increase"),
					seatCount: t("seatSelector.count"),
				}}
			/>
		</div>
	);
}
