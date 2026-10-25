"use client";

import { Minus, Plus } from "lucide-react";
import type * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../button";
import { Input } from "../input";
import {
	clampSeatCount,
	computeSeatTotal,
	formatSeatPrice,
	resolveSeatLabel,
	SEAT_MAX,
	SEAT_MIN,
} from "./utils";

export interface SeatSelectorTranslations {
	title: string;
	seat: string;
	seats: string;
	perMonth: string;
	perYear: string;
	description: string;
}

export interface SeatSelectorProps {
	seatCount: number;
	onChange: (n: number) => void;
	pricePerSeat: number;
	/** ISO 4217 code (e.g. "usd") — drives Intl currency formatting. */
	currency: string;
	/** Fallback symbol when `currency` can't be used by Intl. */
	currencySymbol: string;
	interval?: "month" | "year";
	translations: SeatSelectorTranslations;
	className?: string;
}

export function SeatSelector({
	seatCount,
	onChange,
	pricePerSeat,
	currency,
	currencySymbol,
	interval = "month",
	translations,
	className,
}: SeatSelectorProps) {
	const handleDecrement = () => {
		if (seatCount > SEAT_MIN) {
			onChange(seatCount - 1);
		}
	};

	const handleIncrement = () => {
		if (seatCount < SEAT_MAX) {
			onChange(seatCount + 1);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = Number.parseInt(e.target.value, 10);
		if (Number.isNaN(value)) return;
		onChange(clampSeatCount(value));
	};

	const total = computeSeatTotal(pricePerSeat, seatCount);
	const totalLabel = formatSeatPrice(total, currency, currencySymbol);
	const perSeatLabel = formatSeatPrice(
		pricePerSeat / 100,
		currency,
		currencySymbol,
	);
	const intervalLabel =
		interval === "month" ? translations.perMonth : translations.perYear;
	const seatLabel = resolveSeatLabel(seatCount, translations);

	return (
		<div className={cn("space-y-3", className)}>
			<div>
				<p className="font-medium text-sm">{translations.title}</p>
				<p className="text-muted-foreground text-xs">
					{translations.description}
				</p>
			</div>

			<div className="flex items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={handleDecrement}
					disabled={seatCount <= SEAT_MIN}
					className="size-8"
				>
					<Minus className="size-4" />
				</Button>

				<Input
					type="number"
					min={SEAT_MIN}
					max={SEAT_MAX}
					value={seatCount}
					onChange={handleInputChange}
					className="w-20 text-center"
				/>

				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={handleIncrement}
					disabled={seatCount >= SEAT_MAX}
					className="size-8"
				>
					<Plus className="size-4" />
				</Button>

				<div className="ml-auto text-right">
					<p className="font-semibold text-sm">
						{totalLabel}
						<span className="font-normal text-muted-foreground">
							{intervalLabel}
						</span>
					</p>
					<p className="text-muted-foreground text-xs">
						{perSeatLabel} × {seatCount} {seatLabel}
					</p>
				</div>
			</div>
		</div>
	);
}
