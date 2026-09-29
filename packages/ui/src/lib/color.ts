export type Vec3 = [number, number, number];

function clampChannel(v: number): number {
	return Math.min(1, Math.max(0, v));
}

/** Linear sRGB → sRGB companding. */
function compand(c: number): number {
	return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function oklchToVec3(l: number, c: number, hDeg: number): Vec3 {
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
		clampChannel(
			compand(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
		),
		clampChannel(
			compand(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
		),
		clampChannel(
			compand(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
		),
	];
}

function toChannels(args: string): string[] {
	const noAlpha = args.split("/")[0]?.trim() ?? "";
	if (!noAlpha) return [];
	return noAlpha.includes(",")
		? noAlpha.split(",").map((p) => p.trim())
		: noAlpha.split(/\s+/);
}

/**
 * Parse a CSS color string into linear shader input (sRGB 0–1 vec3).
 *
 * Accepts the formats `getComputedStyle` can emit for a `color` property
 * (`rgb()/rgba()`, `oklch()`, `color(srgb …)`), plus `#rrggbb` for direct
 * props. Anything else — including unresolved relative colors such as
 * `oklch(from var(--brand) l c h)` — returns `fallback`.
 */
export function parseColorToVec3(input: string, fallback: Vec3): Vec3 {
	const s = input.trim();

	const hex = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(s);
	if (hex?.[1] && hex[2] && hex[3]) {
		return [
			Number.parseInt(hex[1], 16) / 255,
			Number.parseInt(hex[2], 16) / 255,
			Number.parseInt(hex[3], 16) / 255,
		];
	}

	const fn = /^([a-z]+)\((.*)\)$/.exec(s);
	const name = fn?.[1];
	const inner = fn?.[2];
	if (!name || inner === undefined) return fallback;
	const parts = toChannels(inner);
	if (parts.length < 3) return fallback;

	if (name === "rgb" || name === "rgba") {
		const chan = parts.slice(0, 3).map((p) => {
			const v = Number.parseFloat(p);
			return p.endsWith("%") ? v / 100 : v / 255;
		});
		return chan.every((v) => Number.isFinite(v)) ? (chan as Vec3) : fallback;
	}

	if (name === "oklch") {
		const [l, c, h] = parts.map((p) => Number.parseFloat(p));
		if (
			Number.isFinite(l) &&
			Number.isFinite(c) &&
			Number.isFinite(h) &&
			l !== undefined &&
			c !== undefined &&
			h !== undefined
		) {
			return oklchToVec3(l, c, h);
		}
		return fallback;
	}

	if (name === "color") {
		const [space, ...channels] = parts;
		if (space !== "srgb" || channels.length < 3) return fallback;
		const vals = channels.slice(0, 3).map((p) => Number.parseFloat(p));
		return vals.every((v) => Number.isFinite(v)) ? (vals as Vec3) : fallback;
	}

	return fallback;
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
	return color;
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
