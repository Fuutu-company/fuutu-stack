"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../../lib/utils";

type ExpandableWrapperProps = {
	children: React.ReactNode;
	ariaLabel?: string;
	/**
	 * Content renders interactive elements (video controls, iframe, custom
	 * children). Interactive content cannot be nested inside a <button> —
	 * use a dedicated corner control instead of a full-area trigger.
	 */
	interactive?: boolean;
};

export function ExpandableWrapper({
	children,
	ariaLabel,
	interactive = false,
}: ExpandableWrapperProps) {
	const [expanded, setExpanded] = useState(false);
	const toggle = useCallback(() => setExpanded((v) => !v), []);
	const close = useCallback(() => setExpanded(false), []);

	// Escape closes the expanded frame (listener only while expanded)
	useEffect(() => {
		if (!expanded) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [expanded, close]);

	// Centering: left:50% + translate:-50% keeps overflow symmetric — auto
	// margins clamp to 0 once the frame exceeds its container, pushing all
	// overflow to one side. Width (not transform:scale) drives expansion.
	// z-index flips instantly on expand but is delayed until after the
	// shrink transition on collapse, so the frame doesn't pop under
	// siblings mid-animation.
	const frameStyle: React.CSSProperties = {
		position: "relative",
		left: "50%",
		translate: "-50% 0",
		zIndex: expanded ? 50 : 10,
		width: expanded ? "min(92vw, 160%)" : "100%",
		transition: `width 0.4s cubic-bezier(0.34,1.56,0.64,1), z-index 0s ${expanded ? "0s" : "0.4s"}`,
	};

	return (
		<div className="relative">
			{/* Backdrop — dark scrim is theme-independent by design */}
			<div
				aria-hidden="true"
				onClick={close}
				style={{
					position: "fixed",
					inset: 0,
					zIndex: 40,
					background: "oklch(0% 0 0 / 55%)",
					backdropFilter: "blur(4px)",
					pointerEvents: expanded ? "auto" : "none",
					opacity: expanded ? 1 : 0,
					transition: "opacity 0.25s ease",
				}}
			/>
			{interactive ? (
				<div style={frameStyle}>
					{children}
					{/* Dedicated expand control — the frame content is interactive
					    (video/iframe/custom), so it can't be wrapped in a button */}
					<button
						type="button"
						aria-label={ariaLabel}
						aria-expanded={expanded}
						onClick={toggle}
						className="absolute top-2 right-2 z-10 flex size-9 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur-sm transition-colors hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						{expanded ? (
							<Minimize2 className="size-4" aria-hidden="true" />
						) : (
							<Maximize2 className="size-4" aria-hidden="true" />
						)}
					</button>
				</div>
			) : (
				/* Frame button — expands via width, not transform:scale(); frame
				   internals re-scale automatically through cqi units */
				<button
					type="button"
					aria-label={ariaLabel}
					aria-expanded={expanded}
					onClick={toggle}
					className={cn(
						"block w-full focus-visible:outline-none",
						expanded ? "cursor-zoom-out" : "cursor-zoom-in",
					)}
					style={frameStyle}
				>
					{children}
				</button>
			)}
		</div>
	);
}
