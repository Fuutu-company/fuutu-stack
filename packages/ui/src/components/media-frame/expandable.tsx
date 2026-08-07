"use client";

import { useCallback, useState } from "react";

type ExpandableWrapperProps = {
	children: React.ReactNode;
	ariaLabel?: string;
};

export function ExpandableWrapper({
	children,
	ariaLabel,
}: ExpandableWrapperProps) {
	const [expanded, setExpanded] = useState(false);
	const toggle = useCallback(() => setExpanded((v) => !v), []);
	const close = useCallback(() => setExpanded(false), []);

	return (
		<div className="relative">
			{/* Backdrop */}
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
			{/* Frame button */}
			<button
				type="button"
				aria-label={ariaLabel ?? "Expand"}
				aria-expanded={expanded}
				onClick={toggle}
				className="block w-full cursor-zoom-in focus-visible:outline-none"
				style={{
					position: "relative",
					zIndex: expanded ? 50 : 10,
					transform: expanded ? "scale(1.6)" : "scale(1)",
					transition:
						"transform 0.4s cubic-bezier(0.34,1.56,0.64,1), z-index 0s",
				}}
			>
				{children}
			</button>
		</div>
	);
}
