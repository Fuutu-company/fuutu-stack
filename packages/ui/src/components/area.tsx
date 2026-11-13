import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export const AREAS = ["users", "billing", "ai", "api"] as const;
export type Area = (typeof AREAS)[number];

/** Literal class strings per area, so Tailwind's scanner sees every one. */
export const AREA_CLASSES: Record<
	Area,
	{ fill: string; ink: string; dot: string }
> = {
	users: {
		fill: "bg-area-users",
		ink: "text-area-users-foreground",
		dot: "bg-area-users-foreground",
	},
	billing: {
		fill: "bg-area-billing",
		ink: "text-area-billing-foreground",
		dot: "bg-area-billing-foreground",
	},
	ai: {
		fill: "bg-area-ai",
		ink: "text-area-ai-foreground",
		dot: "bg-area-ai-foreground",
	},
	api: {
		fill: "bg-area-api",
		ink: "text-area-api-foreground",
		dot: "bg-area-api-foreground",
	},
};

interface AreaTileProps {
	area: Area;
	title: ReactNode;
	value: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
	/**
	 * For tiles side by side: one value line and one caption line (clamped,
	 * full text in `title`; the row is reserved when there is no caption),
	 * so every value in a row sits on the same baseline.
	 */
	aligned?: boolean;
	children?: ReactNode;
	className?: string;
}

export function AreaTile({
	area,
	title,
	value,
	description,
	icon,
	aligned = false,
	children,
	className,
}: AreaTileProps) {
	const { fill, ink } = AREA_CLASSES[area];
	const fullText = (node: ReactNode) =>
		aligned && (typeof node === "string" || typeof node === "number")
			? String(node)
			: undefined;
	return (
		<div
			data-slot="area-tile"
			data-area={area}
			className={cn(
				"flex min-h-40 flex-col gap-1.5 rounded-2xl p-5 shadow-sm",
				fill,
				ink,
				className,
			)}
		>
			<div className="flex items-center justify-between gap-3">
				<span className="font-bold text-sm">{title}</span>
				{icon ? (
					<span aria-hidden="true" className="[&>svg]:size-5">
						{icon}
					</span>
				) : null}
			</div>
			<span
				data-slot="area-tile-value"
				title={fullText(value)}
				className={cn(
					"mt-auto min-w-0 font-extrabold font-heading text-4xl tabular-nums tracking-display",
					aligned ? "block h-10 truncate leading-10" : "break-words",
				)}
			>
				{value}
			</span>
			{description ? (
				<span
					data-slot="area-tile-caption"
					title={fullText(description)}
					className={cn(
						"font-semibold text-sm",
						aligned && "block h-5 truncate leading-5",
					)}
				>
					{description}
				</span>
			) : aligned ? (
				<span aria-hidden="true" className="block h-5" />
			) : null}
			{children}
		</div>
	);
}

interface AreaIconProps {
	area: Area;
	children?: ReactNode;
	size?: "sm" | "md";
	className?: string;
}

export function AreaIcon({
	area,
	children,
	size = "md",
	className,
}: AreaIconProps) {
	const { fill, ink } = AREA_CLASSES[area];
	return (
		<span
			data-slot="area-icon"
			data-area={area}
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-lg",
				size === "sm"
					? "size-6 [&>svg]:size-3.5"
					: "size-9 [&>svg]:size-[1.125rem]",
				fill,
				ink,
				className,
			)}
		>
			{children}
		</span>
	);
}

interface AreaBadgeProps {
	area: Area;
	children: ReactNode;
	className?: string;
}

export function AreaBadge({ area, children, className }: AreaBadgeProps) {
	const { fill, ink } = AREA_CLASSES[area];
	return (
		<span
			data-slot="area-badge"
			data-area={area}
			className={cn(
				"inline-flex h-6 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 font-bold text-xs [&>svg]:size-3",
				fill,
				ink,
				className,
			)}
		>
			{children}
		</span>
	);
}

const BACKDROP_BACKGROUND = [
	"radial-gradient(circle at 15% 20%, var(--area-users), transparent 60%)",
	"radial-gradient(circle at 85% 80%, var(--area-billing), transparent 60%)",
	"var(--background)",
].join(", ");

/** Static decorative layer of two soft area blobs; place inside a `relative` parent. */
export function AreaBackdrop({ className }: { className?: string }) {
	return (
		<div
			data-slot="area-backdrop"
			aria-hidden="true"
			className={cn("pointer-events-none absolute inset-0 -z-10", className)}
			style={{ background: BACKDROP_BACKGROUND }}
		/>
	);
}
