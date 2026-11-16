export const APPS: string[];
export function parseArgs(argv: string[]): {
	apps: string[];
	update: boolean;
	native: boolean;
	open: boolean;
	platform: string | null;
};
export function playwrightVersion(workspaceYaml: string): string;
export function playwrightImage(version: string): string;
export function appPaths(
	root: string,
	app: string,
	mode: "docker" | "native",
): {
	reportRoot: string;
	reportDir: string;
	workDir: string;
	expectedDir: string;
	actualDir: string;
	committedDir: string;
	nativeBaselineDir: string;
};
export function isCiBaseline(file: string): boolean;
export function parseBaseline(file: string): {
	base: string;
	project: string;
	locale: string | null;
	viewport: string | null;
} | null;
export type OrphanReason =
	| "unknown project"
	| "disabled locale"
	| "no visual spec names this page"
	| "viewport shot on the wrong project class";
export function orphanReason(
	file: string,
	ctx: { locales: string[]; specSource: string },
): OrphanReason | null;
export function prunableOrphans(
	files: string[],
	ctx: { locales: string[]; specSource: string },
): string[];
