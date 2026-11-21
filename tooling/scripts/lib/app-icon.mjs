/**
 * App icon from the brand: the logo (`packages/config/assets/logo.svg`) on
 * the sign-in page's backdrop (two soft area blobs over the background,
 * `AreaBackdrop` in @fuutu/ui), always with the LIGHT palette so a dark
 * logo stays visible on dark docks, taskbars and menu bars.
 */

/** @typedef {{ background: string, areaUsers: string, areaBilling: string }} IconColors */

/** Canvas, body (macOS icon grid: 824 px body, 100 px margin) and logo size. */
export const ICON_SIZE = 1024;
const BODY = 824;
const MARGIN = (ICON_SIZE - BODY) / 2;
const RADIUS = 185;
export const LOGO_SIZE = 460;

/** @param {number} value */
const hex2 = (value) =>
	Math.round(Math.min(1, Math.max(0, value)) * 255)
		.toString(16)
		.padStart(2, "0");

/**
 * OKLCH (L 0–1, C, H in degrees) → `#rrggbb` (sRGB, clamped).
 * @param {number} l @param {number} c @param {number} h
 */
export function oklchToHex(l, c, h) {
	const rad = (h * Math.PI) / 180;
	const a = c * Math.cos(rad);
	const b = c * Math.sin(rad);
	const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear = [
		4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
		-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
		-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
	];
	/** @param {number} x */
	const gamma = (x) =>
		x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
	return `#${linear.map((x) => hex2(gamma(x))).join("")}`;
}

/**
 * A CSS color value from brand.css (`oklch(…)` or hex) → `#rrggbb`.
 * @param {string} value
 */
export function cssColorToHex(value) {
	const v = value.trim();
	const ok = v.match(
		/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+\s*)?\)$/i,
	);
	if (ok) {
		const l = Number(ok[1]) / (ok[2] ? 100 : 1);
		return oklchToHex(l, Number(ok[3]), Number(ok[4]));
	}
	const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex?.[1]) {
		const h = hex[1];
		return `#${h.length === 3 ? [...h].map((d) => d + d).join("") : h}`.toLowerCase();
	}
	throw new Error(`app icon: unsupported color "${v}" (use oklch() or hex)`);
}

/**
 * The light palette's backdrop colors (`:root` blocks of brand.css).
 * @param {string} css
 * @returns {IconColors}
 */
export function brandIconColors(css) {
	/** @type {Map<string, string>} */
	const vars = new Map();
	for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
		for (const decl of (block[1] ?? "").matchAll(
			/(--[\w-]+)\s*:\s*([^;]+);/g,
		)) {
			if (decl[1] && decl[2]) vars.set(decl[1], decl[2]);
		}
	}
	/** @param {string} name */
	const read = (name) => {
		const value = vars.get(name);
		if (!value) throw new Error(`app icon: ${name} missing in brand.css :root`);
		return cssColorToHex(value);
	};
	return {
		background: read("--background"),
		areaUsers: read("--area-users"),
		areaBilling: read("--area-billing"),
	};
}

/**
 * Rounded-square backdrop (transparent margin), as an SVG document.
 * @param {IconColors} colors
 */
export function iconBackdropSvg(colors) {
	const body = `x="${MARGIN}" y="${MARGIN}" width="${BODY}" height="${BODY}"`;
	/** @param {string} id @param {string} cx @param {string} cy @param {string} color */
	const blob = (id, cx, cy, color) =>
		`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="70%"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">`,
		"<defs>",
		blob("users", "15%", "20%", colors.areaUsers),
		blob("billing", "85%", "80%", colors.areaBilling),
		`<clipPath id="body"><rect ${body} rx="${RADIUS}"/></clipPath>`,
		"</defs>",
		'<g clip-path="url(#body)">',
		`<rect ${body} fill="${colors.background}"/>`,
		`<rect ${body} fill="url(#users)"/>`,
		`<rect ${body} fill="url(#billing)"/>`,
		"</g>",
		"</svg>",
	].join("");
}
