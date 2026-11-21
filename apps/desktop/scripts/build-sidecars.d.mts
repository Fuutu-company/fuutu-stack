export declare function buildSidecars(
	sidecars: { build?: (input: { target: string }) => unknown },
	input: { target: string },
): Promise<boolean>;
