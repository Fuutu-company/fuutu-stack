/**
 * Tailwind v3-style config kept ONLY for the shadcn CLI (components.json
 * requires tailwind.config). The stack runs Tailwind v4 — no app builds CSS
 * from this file. Theme tokens live in @fuutu/config/theme.css.
 */
import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {},
	},
	plugins: [],
};

export default config;
