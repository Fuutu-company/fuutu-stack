import { cn } from "@fuutu/utils/cn";
import Image from "next/image";
import type { ReactNode } from "react";
import { SCREEN_SIZE, SCREENS, type ScreenId } from "./screens";

/** Glassy app window with three title-bar dots around product screenshots. */
export function ScreenWindow({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative rounded-[1.25rem] bg-card/70 p-1.5 shadow-2xl backdrop-blur-sm sm:rounded-[1.75rem] sm:p-2.5",
				className,
			)}
		>
			<div
				aria-hidden="true"
				className="flex gap-1.5 px-2 pt-1 pb-2 sm:px-2.5 sm:pt-1.5 sm:pb-3"
			>
				<span className="size-2 rounded-full bg-border sm:size-[11px]" />
				<span className="size-2 rounded-full bg-border sm:size-[11px]" />
				<span className="size-2 rounded-full bg-border sm:size-[11px]" />
			</div>
			{children}
		</div>
	);
}

interface ScreenProps {
	id: ScreenId;
	alt: string;
	/** Above the fold (hero, possible LCP): load eagerly instead of lazily. */
	eager?: boolean;
	className?: string;
}

/**
 * One product screenshot at the shared capture size. Served as captured
 * (2x PNG, `unoptimized`): the optimizer's q75 re-encode and its smaller
 * srcset candidates blur UI text.
 */
export function Screen({ id, alt, eager = false, className }: ScreenProps) {
	return (
		<Image
			data-slot="screen"
			src={SCREENS[id]}
			alt={alt}
			width={SCREEN_SIZE.width}
			height={SCREEN_SIZE.height}
			unoptimized
			loading={eager ? "eager" : "lazy"}
			className={cn(
				"block h-auto w-full rounded-[0.875rem] sm:rounded-[1.25rem]",
				className,
			)}
		/>
	);
}
