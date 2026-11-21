import type { i18nConfig } from "./config";
import type { appTranslations } from "./translations/en/app/index";
import type messages from "./translations/en/index";

/**
 * App-owned message overlay (`translations/<locale>/app/index.ts`): sections
 * map to the kit namespaces and merge over them. `docs` stays nested under
 * `docs` when loaded without an app (like the kit's own `docs` namespaces).
 */
export type AppTranslations = Partial<
	Record<
		"common" | "marketing" | "saas" | "docs" | "desktop",
		Record<string, unknown>
	>
>;

type IsObject<T> = T extends readonly unknown[]
	? false
	: T extends object
		? true
		: false;

// Mirrors the runtime deepmerge: objects merge recursively, everything else
// (including arrays) is replaced by the overlay value.
type DeepMerge<A, B> = [keyof B] extends [never]
	? A
	: {
			[K in keyof A | keyof B]: K extends keyof B
				? K extends keyof A
					? IsObject<A[K]> extends true
						? IsObject<B[K]> extends true
							? DeepMerge<A[K], B[K]>
							: B[K]
						: B[K]
					: B[K]
				: K extends keyof A
					? A[K]
					: never;
		};

type Overlay = typeof appTranslations;
type Section<K extends string> = K extends keyof Overlay
	? NonNullable<Overlay[K]>
	: Record<never, never>;

export type Messages = DeepMerge<
	typeof messages,
	Section<"common"> &
		Section<"marketing"> &
		Section<"saas"> &
		([keyof Section<"docs">] extends [never]
			? Record<never, never>
			: { docs: Section<"docs"> }) &
		([keyof Section<"desktop">] extends [never]
			? Record<never, never>
			: { desktop: Section<"desktop"> })
>;
export type Locale = keyof (typeof i18nConfig)["locales"];
