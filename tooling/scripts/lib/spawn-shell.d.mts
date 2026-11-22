export function shellOption(
	command: string,
	platform?: NodeJS.Platform,
): { shell: boolean };
export function shellArgs(
	command: string,
	args: string[],
	platform?: NodeJS.Platform,
): string[];
