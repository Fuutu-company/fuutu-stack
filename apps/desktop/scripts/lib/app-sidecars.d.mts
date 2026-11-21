/** Types of app-sidecars.mjs (app-owned). */

export type SidecarNotice = {
	name: string;
	version: string;
	/** SPDX expression, checked against the licence allowlist. */
	license: string;
	/** Full licence text, shown in About → Licences. */
	text: string;
	repository?: string | null;
};

export declare const APP_EXTERNAL_BIN: string[];
export declare function shippedSidecars(): SidecarNotice[];
