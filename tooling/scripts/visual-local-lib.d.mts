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
