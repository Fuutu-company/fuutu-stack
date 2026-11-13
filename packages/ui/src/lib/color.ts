export type Vec3 = [number, number, number];

function clampChannel(v: number): number {
	return Math.min(1, Math.max(0, v));
}

/** Linear sRGB → sRGB companding. */
function compand(c: number): number {
	return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** OKLCH → linear sRGB, unclamped (values outside 0–1 mean out of gamut). */
export function oklchToLinearSrgb(l: number, c: number, hDeg: number): Vec3 {
	const hRad = (hDeg * Math.PI) / 180;
	const a = c * Math.cos(hRad);
	const b = c * Math.sin(hRad);

	const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = l - 0.1055613458 * a - 0.0638541729 * b;
	const s_ = l - 0.0894841775 * a - 1.291485548 * b;
	const l3 = l_ ** 3;
	const m3 = m_ ** 3;
	const s3 = s_ ** 3;

	return [
		+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
		-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
		-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
	];
}

function oklchToVec3(l: number, c: number, hDeg: number): Vec3 {
	const [r, g, b] = oklchToLinearSrgb(l, c, hDeg);
	return [
		clampChannel(compand(r)),
		clampChannel(compand(g)),
		clampChannel(compand(b)),
	];
}

export function isInSrgbGamut(
	l: number,
	c: number,
	hDeg: number,
	epsilon = 0.0005,
): boolean {
	return oklchToLinearSrgb(l, c, hDeg).every(
		(v) => v >= -epsilon && v <= 1 + epsilon,
	);
}

function toChannels(args: string): string[] {
	const noAlpha = args.split("/")[0]?.trim() ?? "";
	if (!noAlpha) return [];
	return noAlpha.includes(",")
		? noAlpha.split(",").map((p) => p.trim())
		: noAlpha.split(/\s+/);
}

function parseAlpha(raw: string | undefined): number | null {
	if (raw === undefined) return 1;
	const v = Number.parseFloat(raw);
	if (!Number.isFinite(v)) return null;
	return clampChannel(raw.endsWith("%") ? v / 100 : v);
}

function hslToVec3(hDeg: number, sat: number, light: number): Vec3 {
	const h = (((hDeg % 360) + 360) % 360) / 360;
	const s = clampChannel(sat);
	const l = clampChannel(light);
	const a = s * Math.min(l, 1 - l);
	const channel = (n: number) => {
		const k = (n + h * 12) % 12;
		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [channel(0), channel(8), channel(4)];
}

export type ParsedColor = { rgb: Vec3; alpha: number };

/**
 * Parse a CSS color string into gamma-encoded sRGB (0–1) plus alpha.
 *
 * Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()`, `hsl()/hsla()`
 * (space or comma syntax, `deg` or unitless hue), `oklch()` (number or percent
 * lightness, optional `/ alpha`) and `color(srgb …)`. Anything else —
 * including named colors, `color-mix()` and unresolved relative colors such as
 * `oklch(from var(--primary) l c h)` — returns `null`.
 */
export function parseColor(input: string): ParsedColor | null {
	const s = input.trim();

	const hex = /^#?([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.exec(s);
	if (hex?.[1]) {
		let h = hex[1];
		if (h.length === 3) {
			h = [...h].map((ch) => ch + ch).join("");
		}
		const byte = (i: number) => Number.parseInt(h.slice(i, i + 2), 16) / 255;
		return {
			rgb: [byte(0), byte(2), byte(4)],
			alpha: h.length === 8 ? byte(6) : 1,
		};
	}

	const fn = /^([a-z]+)\((.*)\)$/.exec(s);
	const name = fn?.[1];
	const inner = fn?.[2];
	if (!name || inner === undefined) return null;
	const parts = toChannels(inner);
	if (parts.length < 3) return null;

	const slashAlpha = inner.includes("/")
		? inner.split("/")[1]?.trim()
		: undefined;
	const commaAlpha =
		inner.includes(",") && parts.length >= 4 ? parts[3] : undefined;
	const alpha = parseAlpha(slashAlpha ?? commaAlpha);
	if (alpha === null) return null;

	if (name === "rgb" || name === "rgba") {
		const chan = parts.slice(0, 3).map((p) => {
			const v = Number.parseFloat(p);
			return p.endsWith("%") ? v / 100 : v / 255;
		});
		return chan.every((v) => Number.isFinite(v))
			? { rgb: chan as Vec3, alpha }
			: null;
	}

	if (name === "hsl" || name === "hsla") {
		const [hRaw, sRaw, lRaw] = parts;
		if (hRaw === undefined || sRaw === undefined || lRaw === undefined) {
			return null;
		}
		if (!sRaw.endsWith("%") || !lRaw.endsWith("%")) return null;
		const h = Number.parseFloat(hRaw.replace(/deg$/, ""));
		const sat = Number.parseFloat(sRaw) / 100;
		const light = Number.parseFloat(lRaw) / 100;
		if (
			!Number.isFinite(h) ||
			!Number.isFinite(sat) ||
			!Number.isFinite(light)
		) {
			return null;
		}
		return { rgb: hslToVec3(h, sat, light), alpha };
	}

	if (name === "oklch") {
		const [lRaw, cRaw, hRaw] = parts;
		if (lRaw === undefined || cRaw === undefined || hRaw === undefined) {
			return null;
		}
		const l = Number.parseFloat(lRaw);
		const c = Number.parseFloat(cRaw);
		const h = Number.parseFloat(hRaw);
		if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
			return null;
		}
		return {
			rgb: oklchToVec3(lRaw.endsWith("%") ? l / 100 : l, c, h),
			alpha,
		};
	}

	if (name === "color") {
		const [space, ...channels] = parts;
		if (space !== "srgb" || channels.length < 3) return null;
		const vals = channels.slice(0, 3).map((p) => Number.parseFloat(p));
		return vals.every((v) => Number.isFinite(v))
			? { rgb: vals as Vec3, alpha }
			: null;
	}

	return null;
}

/**
 * Parse a CSS color string into shader input (gamma-encoded sRGB 0–1 vec3).
 * Unparseable input returns `fallback`; alpha is ignored.
 */
export function parseColorToVec3(input: string, fallback: Vec3): Vec3 {
	return parseColor(input)?.rgb ?? fallback;
}

/** Source-over compositing in gamma-encoded sRGB, as browsers do. */
export function compositeOver(fg: ParsedColor, bg: Vec3): Vec3 {
	const { rgb, alpha } = fg;
	return [
		rgb[0] * alpha + bg[0] * (1 - alpha),
		rgb[1] * alpha + bg[1] * (1 - alpha),
		rgb[2] * alpha + bg[2] * (1 - alpha),
	];
}

function linearize(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a gamma-encoded sRGB color. */
export function relativeLuminance(rgb: Vec3): number {
	return (
		0.2126 * linearize(rgb[0]) +
		0.7152 * linearize(rgb[1]) +
		0.0722 * linearize(rgb[2])
	);
}

/** WCAG 2.x contrast ratio (1–21), order-independent. */
export function contrastRatio(a: Vec3, b: Vec3): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const WCAG_AA = { text: 4.5, ui: 3 } as const;

/**
 * Rasterize any CSS color the browser understands (lab, oklab, color-mix
 * results) through a 1×1 canvas and return it as `rgb(r g b)`. Returns "" when
 * no canvas is available.
 */
function rasterizeToRgb(value: string): string {
	const ctx = document.createElement("canvas").getContext("2d", {
		willReadFrequently: true,
	});
	if (!ctx) return "";
	ctx.canvas.width = 1;
	ctx.canvas.height = 1;
	ctx.clearRect(0, 0, 1, 1);
	ctx.fillStyle = value;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
	if (r === undefined || g === undefined || b === undefined || !a) return "";
	return `rgb(${r} ${g} ${b})`;
}

/**
 * Resolve a `var(--token)` reference to a computed color string by styling a
 * throwaway probe element. `getComputedStyle` normalizes `oklch(from …)`
 * relative colors into a concrete `oklch(l c h)` / `rgb(r g b)` value that
 * `parseColorToVec3` can convert. Returns "" when unavailable (SSR).
 */
export function resolveCssVarColor(varName: string): string {
	if (typeof document === "undefined" || !document.body) return "";
	const probe = document.createElement("div");
	probe.style.position = "absolute";
	probe.style.visibility = "hidden";
	probe.style.pointerEvents = "none";
	probe.style.color = `var(${varName})`;
	document.body.appendChild(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	// Stylesheet pipelines may emit lab(); rasterize whatever `parseColor` cannot read.
	return parseColor(color) ? color : rasterizeToRgb(color) || color;
}

/**
 * Normalize a color prop into a parseable color string: `var(--x)` is resolved
 * via a probe element; literal values pass through unchanged.
 */
export function resolveColorInput(input: string): string {
	const trimmed = input.trim();
	const varMatch = /^var\(\s*(--[\w-]+)\s*\)$/.exec(trimmed);
	if (varMatch?.[1]) return resolveCssVarColor(varMatch[1]);
	return trimmed;
}
