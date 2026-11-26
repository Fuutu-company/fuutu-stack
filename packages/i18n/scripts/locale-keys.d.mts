export declare function flattenKeys(
	obj: Record<string, unknown>,
	prefix?: string,
): Map<string, string>;
export declare const APP_VIEWS: readonly string[];
export declare function loadLocaleKeys(
	locale: string,
): Promise<{ keys: Map<string, string>; appKeys: Set<string> }>;
export declare function usedKeysIn(
	content: string,
	into?: Set<string>,
): Set<string>;
export declare function findUnusedKeys(
	keys: Iterable<string>,
	used: Set<string>,
): string[];
