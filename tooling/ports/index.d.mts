export type SlotPorts = {
	saas: number;
	marketing: number;
	docs: number;
	mailPreview: number;
	e2eSaas: number;
	e2eMarketing: number;
	browser: number;
};

export type Project = {
	name: string;
	root: string;
	slot: number;
	ports: SlotPorts;
	urls: Record<
		"saas" | "marketing" | "docs" | "mailPreview" | "browserCdp",
		string
	>;
	database: string;
	storageBucketPrefix: string;
	authCookiePrefix: string;
	/** Set when the preferred slot was applied or could not be. */
	notice?: string;
};

export const PROJECT_FILE: string;
export const MAX_SLOT: number;
export const RESERVED_PORTS: number[];
export function slotRanges(slot: number): { apps: number; tools: number };
export function slotPorts(slot: number): SlotPorts;
export function isSlotAllowed(slot: number): boolean;
export function findRoot(from?: string): string;
export function readDotEnv(root: string): Record<string, string>;
export function describeProject(
	root: string,
	slot: number,
	dotEnv?: Record<string, string>,
): Project;
export function readProject(root: string): Project | null;
export function isPortBusy(port: number): Promise<boolean>;
export function readRegistry(): {
	version: number;
	projects: Record<
		string,
		{ slot: number; name: string; lastStarted: string | null }
	>;
};
export function staleProjects(
	registry: ReturnType<typeof readRegistry>,
	now?: number,
): Array<{ path: string; slot: number }>;
type SlotOptions = {
	busy?: (port: number) => Promise<boolean>;
	touch?: boolean;
};
export function ensureSlot(root: string, opts?: SlotOptions): Promise<Project>;
export function setSlot(
	root: string,
	slot: number | undefined,
	opts?: SlotOptions,
): Promise<Project>;
export function releaseSlot(path: string): Promise<void>;
export function readPreferredSlot(root: string): number | undefined;
export function pinSlot(root: string, slot: number | undefined): Promise<void>;
export function slotEnv(
	project: Project,
	env?: Record<string, string | undefined>,
	opts?: { e2e?: boolean },
): Record<string, string>;
