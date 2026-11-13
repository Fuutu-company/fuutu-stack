import type { CSSProperties } from "react";

/** Inline style that places an element in the hero's entrance stagger (`.hero-enter`). */
export function enterStyle(index: number): CSSProperties {
	return { "--enter-index": index } as CSSProperties;
}
