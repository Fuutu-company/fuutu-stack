"use client";

import { Minus, Plus } from "lucide-react";
import type * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../button";
import { Input } from "../input";

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
	currency: string;
	interval?: "month" | "year";
	translations: SeatSelectorTranslations;
	className?: string;
}

const MIN_SEATS = 1;
const MAX_SEATS = 100;

export function SeatSelector({
	seatCount,
	onChange,
	pricePerSeat,
	currency,
	interval = "month",
	translations,
	className,
}: SeatSelectorProps) {
	const handleDecrement = () => {
		if (seatCount > MIN_SEATS) {
			onChange(seatCount - 1);
		}
	};

	const handleIncrement = () => {
		if (seatCount < MAX_SEATS) {
			onChange(seatCount + 1);
		}
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = Number.parseInt(e.target.value, 10);
		if (Number.isNaN(value)) return;
		const clamped = Math.max(MIN_SEATS, Math.min(MAX_SEATS, value));
		onChange(clamped);
	};

	const total = (pricePerSeat * seatCount) / 100; // Convert cents to dollars
	const currencySymbol = currency === "usd" ? "$" : currency;
	const intervalLabel =
		interval === "month" ? translations.perMonth : translations.perYear;
	const seatLabel = seatCount === 1 ? translations.seat : translations.seats;

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
					disabled={seatCount <= MIN_SEATS}
					className="size-8"
				>
					<Minus className="size-4" />
				</Button>

				<Input
					type="number"
					min={MIN_SEATS}
					max={MAX_SEATS}
					value={seatCount}
					onChange={handleInputChange}
					className="w-20 text-center"
				/>

				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={handleIncrement}
					disabled={seatCount >= MAX_SEATS}
					className="size-8"
				>
					<Plus className="size-4" />
				</Button>

				<div className="ml-auto text-right">
					<p className="font-semibold text-sm">
						{currencySymbol}
						{total.toFixed(2)}
						<span className="font-normal text-muted-foreground">
							{intervalLabel}
						</span>
					</p>
					<p className="text-muted-foreground text-xs">
						{currencySymbol}
						{pricePerSeat / 100} × {seatCount} {seatLabel}
					</p>
				</div>
			</div>
		</div>
	);
}
