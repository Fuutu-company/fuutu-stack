export function excludedTestsConfig(entries: readonly string[]): {
	testIgnore?: string[];
	grepInvert?: RegExp;
};
