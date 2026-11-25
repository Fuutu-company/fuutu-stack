export type GeneratedRule = {
	/** Stable kebab-case id, e.g. "prisma-migrations". */
	id: string;
	pattern: RegExp;
	label: string;
	/** What to run instead of a hand edit. */
	command: string;
};

export const SCHEMA_VERSION: 1;
export const GENERATED: GeneratedRule[];
export function matchGeneratedPath(path: string): GeneratedRule | null;
export function matchGeneratedCommand(command: string): GeneratedRule | null;
/** `node tooling/generated-files/index.mjs --json` (schemaVersion 1). */
export function generatedRulesJson(): {
	schemaVersion: 1;
	rules: Array<
		Pick<GeneratedRule, "id" | "label" | "command"> & {
			pattern: { source: string; flags: string };
		}
	>;
};
