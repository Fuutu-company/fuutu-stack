"use client";

import {
	compositeOver,
	contrastRatio,
	type ParsedColor,
	parseColor,
} from "@fuutu/ui/color";
import { useTheme } from "next-themes";
import { type RefObject, useEffect, useState } from "react";

/**
 * Parse a computed color. Browsers serialize `color-mix()` results (for
 * example `bg-destructive/60`) as `oklab()` / `color(srgb …)`; anything
 * `parseColor` does not understand is rasterized through a 1×1 canvas, which
 * yields the sRGB value the user actually sees.
 */
function toColor(value: string): ParsedColor | null {
	const parsed = parseColor(value);
	if (parsed) return parsed;
	const ctx = document.createElement("canvas").getContext("2d", {
		willReadFrequently: true,
	});
	if (!ctx) return null;
	ctx.canvas.width = 1;
	ctx.canvas.height = 1;
	ctx.clearRect(0, 0, 1, 1);
	ctx.fillStyle = value;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
	if (r === undefined || g === undefined || b === undefined || !a) return null;
	return { rgb: [r / 255, g / 255, b / 255], alpha: a / 255 };
}

function pageBackground(): [number, number, number] {
	const body = toColor(getComputedStyle(document.body).backgroundColor);
	return body ? body.rgb : [1, 1, 1];
}

/**
 * Measures the contrast between a foreground element's `color` and a surface
 * element's `background-color`, compositing both over the page background.
 * `null` until mounted (the server renders "—"), then re-measured after every
 * theme change.
 */
export function useMeasuredContrast(
	surface: RefObject<HTMLElement | null>,
	foreground: RefObject<HTMLElement | null>,
): number | null {
	const { resolvedTheme } = useTheme();
	const [ratio, setRatio] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: resolvedTheme re-triggers the measurement after the class on <html> changes
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			const surfaceEl = surface.current;
			const fgEl = foreground.current;
			if (!surfaceEl || !fgEl) return;
			const bg = toColor(getComputedStyle(surfaceEl).backgroundColor);
			const fg = toColor(getComputedStyle(fgEl).color);
			if (!bg || !fg) return;
			const base = compositeOver(bg, pageBackground());
			setRatio(contrastRatio(compositeOver(fg, base), base));
		});
		return () => cancelAnimationFrame(frame);
	}, [resolvedTheme, surface, foreground]);

	return ratio;
}

function toHex(color: ParsedColor): string {
	const byte = (v: number) =>
		Math.round(Math.min(1, Math.max(0, v)) * 255)
			.toString(16)
			.padStart(2, "0");
	const [r, g, b] = color.rgb;
	return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * Reads a theme token from the root element's custom properties and returns
 * it as sRGB hex (the compiled CSS carries `lab()` values, which are not
 * useful to read), re-reading after every theme change. `null` until mounted.
 */
export function useTokenValue(token: string): string | null {
	const { resolvedTheme } = useTheme();
	const [value, setValue] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: resolvedTheme re-triggers the read after the class on <html> changes
	useEffect(() => {
		const frame = requestAnimationFrame(() => {
			const raw = getComputedStyle(document.documentElement)
				.getPropertyValue(`--${token}`)
				.trim();
			const color = raw ? toColor(raw) : null;
			setValue(color ? toHex(color) : null);
		});
		return () => cancelAnimationFrame(frame);
	}, [resolvedTheme, token]);

	return value;
}
