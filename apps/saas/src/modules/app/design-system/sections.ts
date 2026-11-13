/** Page sections in render order. `id` is the anchor, `key` the i18n key under `designSystem.sections`. */
export const DESIGN_SECTIONS = [
	{ id: "foundations", key: "foundations" },
	{ id: "components", key: "components" },
	{ id: "patterns", key: "patterns" },
	{ id: "do-dont", key: "doDont" },
	{ id: "example", key: "example" },
] as const;

export type DesignSectionId = (typeof DESIGN_SECTIONS)[number]["id"];
