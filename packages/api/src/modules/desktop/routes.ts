import { auth } from "@fuutu/auth";
import { config } from "@fuutu/config";
import { anonymousMaxMajor } from "@fuutu/desktop/access";
import {
	DESKTOP_CHANNELS,
	type DesktopChannel,
	desktopConfig,
} from "@fuutu/desktop/config";
import {
	DESKTOP_PLATFORMS,
	type DesktopPlatform,
	type DesktopReleaseManifest,
	decideDownload,
	decideUpdate,
	manifestKey,
	parseManifest,
	updaterTarget,
} from "@fuutu/desktop/updates";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { getObjectStream, resolveStorageProvider } from "@fuutu/storage";
import { storageConfig } from "@fuutu/storage/config";
import { defaultRateLimitStore } from "@fuutu/utils/rate-limit";
import { getClientIp } from "../../client-ip";
import { apiConfig } from "../../config";
import type { ApiApp } from "../../custom-routes";
import { rateLimitedResponse, throttlePreAuth } from "../../pre-auth-throttle";
import { resolveDesktopAccess, resolveDesktopOrganization } from "./access";
import { resolveDesktopBearer } from "./bearer";

const log = createLogger({ scope: "desktop-updates" });

/** Lifetime of a download URL handed to the app or browser. */
const DOWNLOAD_URL_SECONDS = 5 * 60;
/** How long a fetched manifest is reused. */
const MANIFEST_CACHE_MS = 60_000;
/** Update checks / installer clicks per user (or trusted client IP). */
const RELEASE_LIMIT = { maxRequests: 30, windowMs: 60_000 };
const VERSION = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const manifestCache = new Map<
	DesktopChannel,
	{ at: number; manifest: DesktopReleaseManifest | null }
>();

/** The channel's `latest.json` from the releases bucket (cached briefly). */
async function loadManifest(
	channel: DesktopChannel,
): Promise<DesktopReleaseManifest | null> {
	const cached = manifestCache.get(channel);
	if (cached && Date.now() - cached.at < MANIFEST_CACHE_MS) {
		return cached.manifest;
	}
	let manifest: DesktopReleaseManifest | null = null;
	try {
		const object = await getObjectStream(
			storageConfig.buckets.desktopReleases,
			manifestKey(channel),
		);
		if (object) {
			manifest = parseManifest(await new Response(object.body).text());
			if (!manifest) log.warn("invalid release manifest", { channel });
		}
	} catch (err) {
		log.error("release manifest unavailable", { channel, err: String(err) });
		return null; // not cached: storage hiccups retry on the next request
	}
	manifestCache.set(channel, { at: Date.now(), manifest });
	return manifest;
}

/** For tests. */
export function clearDesktopManifestCache() {
	manifestCache.clear();
}

function channelOf(raw: string | undefined): DesktopChannel | null {
	const channel = raw ?? desktopConfig.updates.defaultChannel;
	return (DESKTOP_CHANNELS as readonly string[]).includes(channel)
		? (channel as DesktopChannel)
		: null;
}

const presign = (key: string) =>
	resolveStorageProvider().getSignedDownloadUrl({
		bucket: storageConfig.buckets.desktopReleases,
		key,
		expiresInSeconds: DOWNLOAD_URL_SECONDS,
	});

/** 429 once `caller` is over `RELEASE_LIMIT`; no caller key → unlimited. */
async function overLimit(
	surface: string,
	caller: string | null,
): Promise<Response | null> {
	if (!apiConfig.rateLimit.enabled || !caller) return null;
	const result = await defaultRateLimitStore.check(
		`desktop:${surface}:${caller}`,
		RELEASE_LIMIT,
	);
	return result.allowed ? null : rateLimitedResponse(result.resetAt);
}

/** `ip:<addr>` behind a trusted proxy, else `null` (no shared bucket). */
function ipCaller(headers: Headers): string | null {
	if (!apiConfig.rateLimit.trustProxyHeaders) return null;
	const ip = getClientIp(headers, true);
	return ip ? `ip:${ip}` : null;
}

function bearerOf(headers: Headers): string | null {
	const value = headers.get("authorization") ?? "";
	return /^bearer /i.test(value) ? value.slice(7).trim() || null : null;
}

/**
 * Desktop release routes (`config.features.desktop`; 404 while off),
 * mounted before `createContext` — they authenticate themselves:
 *
 * - `GET /api/desktop/updates/:target/:arch/:current_version?channel=` —
 *   the Tauri updater endpoint: 204 (no update) or the update JSON with a
 *   5-minute download URL from the private releases bucket. With
 *   `desktopConfig.auth: "required"` it needs the app's access token and
 *   access to the app; a licence for a lower major never gets a newer one.
 * - `GET /api/desktop/download` — `{ version, platforms }` of the current
 *   release (which installers exist), for the download buttons.
 * - `GET /api/desktop/download/:platform` — 302 to the current installer.
 *   With auth `required` only for a signed-in browser (others are sent to
 *   the sign-in page and come back to the settings page).
 */
export function mountDesktopRoutes(app: ApiApp): void {
	app.get("/desktop/updates/:target/:arch/:current_version", async (c) => {
		if (!config.features.desktop) return c.notFound();
		const target = updaterTarget(c.req.param("target"), c.req.param("arch"));
		const currentVersion = c.req.param("current_version");
		const channel = channelOf(c.req.query("channel"));
		if (!target || !channel || !VERSION.test(currentVersion)) {
			return c.json({ error: "invalid_request" }, 400);
		}

		// Without an account: only majors no licence guards. The version in
		// the URL proves nothing — a higher major needs a token. Binaries stay
		// downloadable for anyone who knows a URL unless auth is `required`.
		let maxLicensedMajor: number | null = anonymousMaxMajor(
			desktopConfig.access,
		);
		let caller = ipCaller(c.req.raw.headers);
		const token = bearerOf(c.req.raw.headers);
		if (desktopConfig.auth === "required" || token) {
			const attempt = await throttlePreAuth(c.req.raw.headers, "desktop");
			if (attempt.limited) return attempt.limited;
			const resolved = token
				? await attempt.verify(() => resolveDesktopBearer(token))
				: null;
			if (!resolved) return c.json({ error: "unauthorized" }, 401);
			caller = `user:${resolved.user.id}`;
			const tooMany = await overLimit("updates", caller);
			if (tooMany) return tooMany;
			// The token's org only while the user is still a member.
			const organization = await resolveDesktopOrganization(
				resolved.user.id,
				undefined,
				resolved.desktop.organizationId,
			);
			const { access } = await resolveDesktopAccess({
				userId: resolved.user.id,
				userCreatedAt: resolved.user.createdAt,
				organizationId: organization?.id ?? null,
			});
			if (
				desktopConfig.auth === "required" &&
				access.status !== "granted" &&
				access.status !== "trial"
			) {
				return c.json({ error: "forbidden" }, 403);
			}
			maxLicensedMajor = access.maxLicensedMajor;
		} else {
			const tooMany = await overLimit("updates", caller);
			if (tooMany) return tooMany;
		}

		const manifest = await loadManifest(channel);
		if (!manifest) return c.body(null, 204);
		const update = decideUpdate({
			manifest,
			target,
			currentVersion,
			maxLicensedMajor,
		});
		if (!update) return c.body(null, 204);
		const { key, ...release } = update;
		c.header("Cache-Control", "no-store");
		return c.json({ ...release, url: await presign(key) });
	});

	app.get("/desktop/download", async (c) => {
		if (!config.features.desktop) return c.notFound();
		const manifest = await loadManifest(desktopConfig.updates.defaultChannel);
		c.header("Cache-Control", "public, max-age=60");
		return c.json({
			version: manifest?.version ?? null,
			platforms: manifest
				? DESKTOP_PLATFORMS.filter((p) => decideDownload(manifest, p))
				: [],
		});
	});

	app.get("/desktop/download/:platform", async (c) => {
		if (!config.features.desktop) return c.notFound();
		const platform = c.req.param("platform");
		if (!(DESKTOP_PLATFORMS as readonly string[]).includes(platform)) {
			return c.notFound();
		}
		let caller = ipCaller(c.req.raw.headers);
		if (desktopConfig.auth === "required") {
			const session = await auth.api.getSession({ headers: c.req.raw.headers });
			if (session) caller = `user:${session.user.id}`;
			if (!session) {
				const signIn = new URL(
					"/auth/sign-in",
					env.NEXT_PUBLIC_SAAS_URL ?? env.BETTER_AUTH_URL,
				);
				signIn.searchParams.set("redirect", "/settings/desktop");
				return c.redirect(signIn.toString(), 302);
			}
		}
		const tooMany = await overLimit("download", caller);
		if (tooMany) return tooMany;
		const manifest = await loadManifest(desktopConfig.updates.defaultChannel);
		const key =
			manifest && decideDownload(manifest, platform as DesktopPlatform);
		if (!key) return c.notFound();
		c.header("Cache-Control", "no-store");
		return c.redirect(await presign(key), 302);
	});
}
