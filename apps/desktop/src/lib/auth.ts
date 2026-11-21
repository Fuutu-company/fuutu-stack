import {
	type DesktopSession,
	desktopSessionSchema,
} from "@fuutu/desktop/session";
import { inDesktop } from "./desktop";

/**
 * The account side of the app. Tokens never reach the webview: sign-in,
 * the keychain and every backend call run in Rust (`src-tauri/src/auth`).
 */

export type AuthMode = "required" | "optional" | "off";

export type AuthStatus = {
	mode: AuthMode;
	/** Backend URL compiled in and auth not off. */
	available: boolean;
	signedIn: boolean;
};

/** Error from a Rust auth command (`AuthError`). */
export type AuthErrorKind =
	| "network"
	| "signed_out"
	| "rejected"
	| "unavailable"
	| "keychain"
	| "invalid"
	| "cancelled"
	| "timeout";

export class DesktopAuthError extends Error {
	constructor(
		readonly kind: AuthErrorKind,
		message?: string,
	) {
		super(message ?? kind);
		this.name = "DesktopAuthError";
	}
}

/** Claim verified in Rust while offline — the only basis for access then. */
export type OfflineClaim = {
	sub: string;
	org: string | null;
	access: "granted" | "trial";
	maxMajor: number | null;
	exp: number;
};

export type SessionState =
	| { state: "signed_out" }
	| { state: "online"; session: DesktopSession }
	| { state: "offline"; session: DesktopSession | null; claim: OfflineClaim }
	| { state: "unreachable"; reason: string };

export const AUTH_CHANGED_EVENT = "desktop://auth-changed";
export const SESSION_REFRESH_EVENT = "desktop://session-refresh";

async function call<T>(command: string, args?: Record<string, unknown>) {
	const { invoke } = await import("@tauri-apps/api/core");
	try {
		return await invoke<T>(command, args);
	} catch (err) {
		const e = err as { kind?: AuthErrorKind; message?: string };
		throw new DesktopAuthError(e?.kind ?? "invalid", e?.message);
	}
}

const BROWSER_STATUS: AuthStatus = {
	mode: "off",
	available: false,
	signedIn: false,
};

export const getAuthStatus = (): Promise<AuthStatus> =>
	inDesktop()
		? call<AuthStatus>("auth_status")
		: Promise.resolve(BROWSER_STATUS);

/** Text of the browser tab shown after the redirect back to the app. */
export type CallbackPage = { title: string; body: string };

/** Opens the sign-in in the system browser; resolves once signed in. */
export const signIn = (page: CallbackPage) =>
	call<void>("auth_sign_in", { page });

export const cancelSignIn = () => call<void>("auth_cancel_sign_in");

export const signOut = () => call<void>("auth_sign_out");

/** `desktop.session` (or the offline grace) for `organizationId`. */
export async function getSession(
	organizationId?: string | null,
): Promise<SessionState> {
	const result = await call<SessionState>("auth_session", {
		organizationId: organizationId ?? null,
	});
	if (result.state === "online") {
		return { ...result, session: desktopSessionSchema.parse(result.session) };
	}
	if (result.state === "offline") {
		const parsed = desktopSessionSchema.safeParse(result.session);
		return { ...result, session: parsed.success ? parsed.data : null };
	}
	return result;
}

/**
 * JSON call to `<saas>/api/…` (the OpenAPI routes of your procedures) as
 * the signed-in user — anonymous when signed out. Throws
 * `DesktopAuthError("network")` when the backend is unreachable.
 */
export async function apiFetch<T = unknown>(
	path: `/api/${string}`,
	init: {
		method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
		body?: unknown;
	} = {},
): Promise<{ status: number; data: T | null }> {
	const res = await call<{ status: number; body: string }>("auth_api_fetch", {
		request: {
			path,
			method: init.method ?? "GET",
			body: init.body === undefined ? null : JSON.stringify(init.body),
		},
	});
	let data: T | null = null;
	try {
		data = res.body ? (JSON.parse(res.body) as T) : null;
	} catch {
		data = null;
	}
	return { status: res.status, data };
}

/**
 * Subscribes to sign-in changes (`signedIn` true/false) and "reload the
 * session" deep links (`signedIn` null).
 */
export async function onAuthEvents(
	handler: (signedIn: boolean | null) => void,
): Promise<() => void> {
	if (!inDesktop()) return () => {};
	const { listen } = await import("@tauri-apps/api/event");
	const unlisten = await Promise.all([
		listen<boolean>(AUTH_CHANGED_EVENT, (event) => handler(event.payload)),
		listen(SESSION_REFRESH_EVENT, () => handler(null)),
	]);
	return () => {
		for (const off of unlisten) off();
	};
}

/** The backend refused an organization switch (not a member any more). */
export const isForbiddenSwitch = (err: unknown): boolean =>
	err instanceof DesktopAuthError &&
	err.kind === "rejected" &&
	err.message.includes("403");

/** Major version of a semver string (`2.4.1` → 2). */
export const majorOf = (version: string): number =>
	Number.parseInt(version.split(".")[0] ?? "0", 10) || 0;

export type AccessDecision =
	| { kind: "open" }
	| { kind: "sign_in" }
	| { kind: "granted"; trialEndsAt: string | null; offline: boolean }
	| { kind: "missing" }
	| { kind: "device_limit" }
	| { kind: "upgrade"; licensedMajor: number }
	| { kind: "unreachable" };

/**
 * May this build be used? `required` needs a signed-in account with
 * access (online: `desktop.session`; offline: the verified claim) and a
 * licence for this major version; `optional` / `off` never block.
 */
export function decideAccess(
	mode: AuthMode,
	session: SessionState | undefined,
	appVersion: string,
): AccessDecision {
	if (mode !== "required") return { kind: "open" };
	if (!session || session.state === "signed_out") return { kind: "sign_in" };
	if (session.state === "unreachable") return { kind: "unreachable" };
	const major = majorOf(appVersion);
	if (session.state === "offline") {
		const { claim } = session;
		if (claim.maxMajor !== null && major > claim.maxMajor) {
			return { kind: "upgrade", licensedMajor: claim.maxMajor };
		}
		return { kind: "granted", trialEndsAt: null, offline: true };
	}
	const { access } = session.session;
	if (access.status === "missing") return { kind: "missing" };
	if (access.status === "device_limit") return { kind: "device_limit" };
	if (access.maxLicensedMajor !== null && major > access.maxLicensedMajor) {
		return { kind: "upgrade", licensedMajor: access.maxLicensedMajor };
	}
	return { kind: "granted", trialEndsAt: access.trialEndsAt, offline: false };
}
