export declare function denyConfig(kit: string, app: string): string;
export declare function cargoDenyMissing(
	run?: () => { status: number | null; error?: Error },
): string | null;
