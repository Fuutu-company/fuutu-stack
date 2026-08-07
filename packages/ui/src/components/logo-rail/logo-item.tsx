"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type { LogoItem } from "./types";

type LogoItemCardProps = {
	item: LogoItem;
};

type TooltipPos = { top: number; left: number };

export function LogoItemCard({ item }: LogoItemCardProps) {
	const [hovered, setHovered] = useState(false);
	const [pos, setPos] = useState<TooltipPos | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!hovered || !ref.current) return;
		if (window.matchMedia("(hover: none)").matches) return;

		const update = () => {
			const rect = ref.current?.getBoundingClientRect();
			if (!rect) return;
			setPos({ top: rect.top - 10, left: rect.left + rect.width / 2 });
		};

		update();
		window.addEventListener("scroll", update, { passive: true, capture: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, { capture: true });
			window.removeEventListener("resize", update);
		};
	}, [hovered]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover-only tooltip trigger — touch devices skip via matchMedia guard, no keyboard equivalent needed
		<div
			ref={ref}
			className="relative overflow-visible"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{/* Glow aura — fixed negative inset avoids layout overflow / scrollbar */}
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute -z-10 rounded-full transition-opacity duration-500",
					hovered ? "opacity-100" : "opacity-0",
				)}
				style={{
					inset: "-120%",
					background:
						"radial-gradient(ellipse at center, oklch(var(--primary)/0.4) 0%, transparent 65%)",
					filter: "blur(12px)",
				}}
			/>
			{/* Logo pill */}
			<div
				className={cn(
					"flex size-10 shrink-0 cursor-default items-center justify-center rounded-xl bg-background p-2 transition-all duration-300 sm:size-12 sm:p-2.5",
					hovered
						? "scale-[1.2] bg-primary/8 opacity-100 shadow-[0_0_0_1px_oklch(var(--primary)/0.3),0_0_16px_oklch(var(--primary)/0.15)]"
						: "opacity-50",
				)}
			>
				<img
					src={item.logo}
					alt={item.logoAlt}
					className={cn(
						"size-full object-contain",
						item.invertInDark && "dark:invert",
					)}
					loading="lazy"
					decoding="async"
				/>
			</div>

			{/* Tooltip — fixed to escape overflow clipping */}
			{pos && (
				<div
					aria-hidden={!hovered}
					style={{ top: pos.top, left: pos.left }}
					className={cn(
						"pointer-events-none fixed z-9999 w-60 -translate-x-1/2 rounded-2xl border border-border bg-popover shadow-[0_8px_40px_-8px_rgba(0,0,0,0.35)] transition-all duration-150",
						hovered
							? "-translate-y-full opacity-100"
							: "-translate-y-[calc(100%+8px)] opacity-0",
					)}
				>
					{/* Header with logo */}
					<div className="flex items-center gap-3 border-border border-b px-4 py-3">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted p-1.5">
							<img
								src={item.logo}
								alt=""
								aria-hidden="true"
								className={cn(
									"size-full object-contain",
									item.invertInDark && "dark:invert",
								)}
							/>
						</div>
						<p className="font-semibold text-foreground text-sm">{item.name}</p>
					</div>

					{/* Body */}
					<div className="px-4 py-3">
						<p className="text-muted-foreground text-xs leading-relaxed">
							{item.description}
						</p>
						{item.detail && (
							<p className="mt-2 border-border border-t pt-2 font-mono text-[11px] text-foreground/50 leading-relaxed">
								{item.detail}
							</p>
						)}
					</div>

					{/* Arrow */}
					<div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-border" />
					<div className="absolute top-full left-1/2 -mt-px -translate-x-1/2 border-[5px] border-transparent border-t-popover" />
				</div>
			)}
		</div>
	);
}
