"use client";

import { useId } from "react";
import { cn } from "../../lib/utils";
import { VARIANT_BG, VARIANT_ICON, VARIANT_LABEL } from "./constants";
import type { MacFrameVariant, SizePosition } from "./types";

type FramePlaceholderProps = {
	variant: MacFrameVariant;
	label?: string;
	size?: string;
	sizePosition?: SizePosition;
	rounded: string;
	roundedStyle?: string;
	height?: number | string;
	iphoneFill: boolean;
};

const SIZE_POSITION_CLASSES: Record<
	SizePosition,
	{
		wrapper: string;
		wrapperStyle?: React.CSSProperties;
		textStyle?: React.CSSProperties;
		text: string;
	}
> = {
	"bottom-right": {
		wrapper:
			"absolute bottom-0 right-0 translate-x-[5%] translate-y-[15%] select-none",
		text: "font-black leading-none tracking-tighter",
		textStyle: { fontSize: "10cqw" } as React.CSSProperties,
	},
	"bottom-left": {
		wrapper:
			"absolute bottom-0 left-0 translate-x-[5%] translate-y-[15%] select-none",
		text: "font-black leading-none tracking-tighter",
		textStyle: { fontSize: "10cqw" } as React.CSSProperties,
	},
	"top-right": {
		wrapper:
			"absolute right-0 top-0 translate-x-[5%] -translate-y-[15%] select-none",
		text: "font-black leading-none tracking-tighter",
		textStyle: { fontSize: "10cqw" } as React.CSSProperties,
	},
	"top-left": {
		wrapper:
			"absolute left-0 top-0 -translate-x-[5%] -translate-y-[15%] select-none",
		text: "font-black leading-none tracking-tighter",
		textStyle: { fontSize: "10cqw" } as React.CSSProperties,
	},
	"bottom-right-vertical": {
		wrapper: "absolute select-none",
		wrapperStyle: { bottom: "8%", right: "3%" } as React.CSSProperties,
		textStyle: {
			writingMode: "vertical-rl",
			transform: "rotate(180deg)",
			fontSize: "8cqmin",
		} as React.CSSProperties,
		text: "font-black leading-none tracking-tighter",
	},
	"bottom-left-vertical": {
		wrapper: "absolute select-none",
		wrapperStyle: { bottom: "8%", left: "3%" } as React.CSSProperties,
		textStyle: {
			writingMode: "vertical-rl",
			transform: "rotate(180deg)",
			fontSize: "8cqmin",
		} as React.CSSProperties,
		text: "font-black leading-none tracking-tighter",
	},
};

export function FramePlaceholder({
	variant,
	label,
	size,
	sizePosition,
	rounded,
	roundedStyle,
	height,
	iphoneFill,
}: FramePlaceholderProps) {
	const uid = useId();
	const gridId = `mf-grid-${uid.replace(/:/g, "")}`;
	const effectivePosition: SizePosition =
		sizePosition ?? (iphoneFill ? "bottom-left-vertical" : "bottom-right");
	const sizeStyle = SIZE_POSITION_CLASSES[effectivePosition];
	const contentStyle = height ? { height } : undefined;
	const wrapperStyle = iphoneFill
		? roundedStyle
			? { borderRadius: roundedStyle }
			: undefined
		: {
				...contentStyle,
				...(roundedStyle ? { borderRadius: roundedStyle } : {}),
			};

	return (
		<div
			className={cn(
				"relative overflow-hidden",
				rounded,
				iphoneFill ? "absolute inset-0 size-full" : !height && "aspect-video",
				VARIANT_BG[variant],
			)}
			style={wrapperStyle}
		>
			{/* Inner container — container-type:size gives us cqw + cqh + cqmin.
			    cqmin = min(width, height): portrait iPhone → width wins, landscape Chrome → height wins.
			    Every size below is expressed as a % of cqmin so proportions are correct in any orientation. */}
			<div
				className="absolute inset-0"
				style={{ containerType: "size", containerName: "placeholder" }}
			>
				{/* Subtle grid */}
				<svg
					aria-hidden="true"
					className="absolute inset-0 size-full opacity-[0.07]"
					xmlns="http://www.w3.org/2000/svg"
				>
					<defs>
						<pattern
							id={gridId}
							width="32"
							height="32"
							patternUnits="userSpaceOnUse"
						>
							<path
								d="M 32 0 L 0 0 0 32"
								fill="none"
								stroke="currentColor"
								strokeWidth="0.5"
							/>
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill={`url(#${gridId})`} />
				</svg>

				{/* Center: icon + label — all sizes relative to cqmin */}
				<div
					className="absolute inset-0 flex flex-col items-center justify-center"
					style={{ gap: "10cqmin" }}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className={cn(VARIANT_ICON[variant])}
						style={{ width: "22cqmin", height: "22cqmin" }}
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
						<circle cx="9" cy="9" r="2" />
						<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
					</svg>
					{label && (
						<p
							className={cn(
								"font-semibold tracking-wide",
								VARIANT_ICON[variant],
							)}
							style={{ fontSize: "7cqmin" }}
						>
							{label}
						</p>
					)}
				</div>

				{/* Editorial size watermark */}
				{size && (
					<div
						aria-hidden="true"
						className={sizeStyle.wrapper}
						style={sizeStyle.wrapperStyle}
					>
						<p
							className={cn(sizeStyle.text, VARIANT_LABEL[variant])}
							style={sizeStyle.textStyle}
						>
							{size}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
