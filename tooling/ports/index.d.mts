export type SlotPorts = {
	saas: number;
	marketing: number;
	docs: number;
	mailPreview: number;
	e2eSaas: number;
	e2eMarketing: number;
	e2eDocs: number;
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
		{
			slot: number;
			name: string;
			database?: string;
			lastStarted: string | null;
		}
	>;
	/** Slots whose released project's local data was kept (not dropped). */
	keptData?: Record<
		string,
		{ path: string; database: string | null; keptAt: string }
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
type RegistryEntry = ReturnType<typeof readRegistry>["projects"][string];
export type ReleasedSlot = RegistryEntry & {
	path: string;
	database: string | null;
};
export type PruneCandidate = RegistryEntry & {
	path: string;
	reason: "missing" | "not-a-project" | "orphaned-worktree";
	/** Why the entry stays: slot 0, pinned or running. null = dropped / droppable. */
	kept: string | null;
};
export function isSlotRunning(
	slot: number,
	busy?: (port: number) => Promise<boolean>,
): Promise<boolean>;
export function checkoutKind(path: string): "main" | "worktree";
export function projectGone(path: string): PruneCandidate["reason"] | null;
export function pruneRegistry(opts?: {
	apply?: boolean;
	busy?: (port: number) => Promise<boolean>;
	keep?: string;
	missingOnly?: boolean;
}): Promise<PruneCandidate[]>;
export function releaseSlot(
	path: string,
	opts?: { busy?: (port: number) => Promise<boolean> },
): Promise<ReleasedSlot>;
export function clearKeptData(slot: number): Promise<void>;
export function databasesInUse(
	registry?: ReturnType<typeof readRegistry>,
): Set<string>;
export function legacySlotDatabases(
	slot: number,
	names: string[],
	inUse?: Set<string>,
): string[];
export function keptSlots(
	registry?: ReturnType<typeof readRegistry>,
): { slot: number; path: string; database: string | null }[];
export function planKeptDrop(
	kept: { slot: number; database: string | null },
	existing: { databases?: string[]; buckets?: string[] },
	registry?: ReturnType<typeof readRegistry>,
): {
	databases: string[];
	bucketPrefix: string;
	buckets: string[];
	empty: boolean;
};
export function parseArgs(argv: string[]): {
	command: string;
	arg: string | undefined;
	flags: Set<string>;
};
export function mainCheckoutRoot(root: string): string | null;
export function serviceEnv(
	root: string,
	key: string,
	opts?: { env?: Record<string, string | undefined>; mainRoot?: string | null },
): { env: Record<string, string | undefined>; source: string };
export function minioCredentials(env: Record<string, string | undefined>): {
	accessKeyId: string;
	secretAccessKey: string;
	from: "S3_ACCESS_KEY_ID" | "MINIO_ROOT_USER" | "compose default";
};
export function slotData(
	released: { slot: number; database?: string | null },
	registry?: ReturnType<typeof readRegistry>,
): { databases: string[]; bucketPrefix: string } | null;
export function readPreferredSlot(root: string): number | undefined;
export function pinSlot(root: string, slot: number | undefined): Promise<void>;
export function slotEnv(
	project: Project,
	env?: Record<string, string | undefined>,
	opts?: { e2e?: boolean },
): Record<string, string>;
/** slotEnv for a one-off command: root .env under the process env. */
export const SLOT_ENV_MARKER: "FUUTU_SLOT_ENV";
export function commandSlotEnv(
	root: string,
	project: Project,
	env?: Record<string, string | undefined>,
): Record<string, string>;
/** True for unset values and URLs whose parsed host is localhost / 127.0.0.1 / ::1. */
export function isLocal(value: string | undefined): boolean;
/** True only for a local URL naming exactly `${project.database}-e2e`. */
export function isE2eResetTarget(
	value: string | undefined,
	project: Pick<Project, "database">,
): boolean;
