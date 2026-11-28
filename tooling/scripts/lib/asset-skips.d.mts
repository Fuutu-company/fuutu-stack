export function parseKeepFile(text: string): string[];
export function assetSkips(input: {
	argv: readonly string[];
	keepText: string | null;
}): Map<string, "--skip" | "keep.txt">;
