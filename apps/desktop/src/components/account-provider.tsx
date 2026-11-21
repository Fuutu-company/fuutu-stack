"use client";

import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type AccessDecision,
	type AuthStatus,
	decideAccess,
	getAuthStatus,
	getSession,
	isForbiddenSwitch,
	onAuthEvents,
	type SessionState,
	signOut,
} from "@/lib/auth";
import { inDesktop } from "@/lib/desktop";

const ORG_KEY = "desktop.organizationId";

function readOrg(): string | null {
	if (typeof window === "undefined") return null; // static prerender
	try {
		return window.localStorage.getItem(ORG_KEY);
	} catch {
		return null;
	}
}

function writeOrg(id: string | null) {
	try {
		if (id) window.localStorage.setItem(ORG_KEY, id);
		else window.localStorage.removeItem(ORG_KEY);
	} catch {
		// Private mode / blocked storage: the switch lasts for this run only.
	}
}

type Account = {
	status: AuthStatus | undefined;
	session: SessionState | undefined;
	decision: AccessDecision | undefined;
	appVersion: string;
	loading: boolean;
	organizationId: string | null;
	setOrganizationId: (id: string | null) => void;
	/** The last organization switch was refused (no longer a member). */
	switchFailed: boolean;
	refresh: () => Promise<void>;
	/** Signs out (revokes this device) and forgets the chosen organization. */
	signOut: () => Promise<void>;
};

const AccountContext = createContext<Account | null>(null);

export const ACCOUNT_QUERY_KEY = ["desktop", "account"] as const;

async function readAppVersion(): Promise<string> {
	if (!inDesktop()) return "0.0.0";
	const { getVersion } = await import("@tauri-apps/api/app");
	return getVersion();
}

/**
 * Auth status + `desktop.session` (online or offline grace) for the whole
 * app. Reloads on sign-in/out, on `<scheme>://auth/return` deep links and
 * when the window regains focus (e.g. back from a purchase).
 */
export function AccountProvider({ children }: PropsWithChildren) {
	const queryClient = useQueryClient();
	// Read synchronously: the first session request already uses it.
	const [organizationId, setOrg] = useState<string | null>(readOrg);
	const [switchFailed, setSwitchFailed] = useState(false);

	const status = useQuery({
		queryKey: [...ACCOUNT_QUERY_KEY, "status"],
		queryFn: getAuthStatus,
		staleTime: 0,
	});
	const version = useQuery({
		queryKey: [...ACCOUNT_QUERY_KEY, "version"],
		queryFn: readAppVersion,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const sessionEnabled =
		status.data?.available === true && status.data.signedIn;
	const session = useQuery({
		queryKey: [...ACCOUNT_QUERY_KEY, "session", organizationId],
		queryFn: () => getSession(organizationId),
		enabled: sessionEnabled,
		staleTime: 30_000,
		retry: false,
		// An organization switch keeps the current session on screen.
		placeholderData: keepPreviousData,
	});

	const refresh = useCallback(
		() => queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
		[queryClient],
	);

	const setOrganizationId = useCallback((id: string | null) => {
		writeOrg(id);
		setOrg(id);
		setSwitchFailed(false);
	}, []);

	useEffect(() => {
		let off: (() => void) | undefined;
		let cancelled = false;
		void onAuthEvents((signedIn) => {
			// Another account may sign in next: its org choice starts fresh.
			if (signedIn === false) setOrganizationId(null);
			void refresh();
		}).then((unlisten) => {
			if (cancelled) unlisten();
			else off = unlisten;
		});
		return () => {
			cancelled = true;
			off?.();
		};
	}, [refresh, setOrganizationId]);

	// A refused switch (left the organization) → back to the default org,
	// with a notice. Other errors keep the choice.
	useEffect(() => {
		if (session.isError && organizationId && isForbiddenSwitch(session.error)) {
			writeOrg(null);
			setOrg(null);
			setSwitchFailed(true);
		}
	}, [session.isError, session.error, organizationId]);

	const doSignOut = useCallback(async () => {
		try {
			await signOut();
		} finally {
			setOrganizationId(null);
			await refresh();
		}
	}, [refresh, setOrganizationId]);

	const sessionState: SessionState | undefined = !status.data
		? undefined
		: !sessionEnabled
			? { state: "signed_out" }
			: session.isError
				? isForbiddenSwitch(session.error)
					? undefined // resetting to the default org
					: { state: "unreachable", reason: String(session.error) }
				: session.data;
	const appVersion = version.data ?? "0.0.0";
	// Only the first load blocks the window; refetches keep the content.
	const loading =
		status.isPending ||
		version.isPending ||
		(sessionEnabled && sessionState === undefined);

	const value = useMemo<Account>(
		() => ({
			status: status.data,
			session: sessionState,
			decision:
				status.data && !loading
					? decideAccess(status.data.mode, sessionState, appVersion)
					: undefined,
			appVersion,
			loading,
			organizationId,
			setOrganizationId,
			switchFailed,
			refresh,
			signOut: doSignOut,
		}),
		[
			status.data,
			sessionState,
			appVersion,
			loading,
			organizationId,
			setOrganizationId,
			switchFailed,
			refresh,
			doSignOut,
		],
	);

	return (
		<AccountContext.Provider value={value}>{children}</AccountContext.Provider>
	);
}

export function useAccount(): Account {
	const account = useContext(AccountContext);
	if (!account) throw new Error("useAccount outside AccountProvider");
	return account;
}
