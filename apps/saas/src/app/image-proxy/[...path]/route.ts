import { createLogger } from "@fuutu/logs";
import { createEvlog } from "@fuutu/logs/next";
import { getObjectStream, resolveBucketAlias } from "@fuutu/storage";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth-server";

// evlog route-handler integration — wraps GET so each image-proxy request
// emits a single wide event (method/path/status/duration). Events go
// through the global logger configured by initLogs() in instrumentation.ts.
const { withEvlog } = createEvlog({ service: "saas" });

const log = createLogger({ scope: "image-proxy" });

/**
 * Image proxy for private buckets.
 *
 * Fronts the `@fuutu/storage` provider so the browser never gets a
 * signed URL (those leak bucket paths, expiry timestamps and the real
 * storage host). The URL shape is deliberately short and stable:
 *
 *     /image-proxy/<bucket-alias>/<...object-key>
 *
 * where `<bucket-alias>` is one of the public aliases in
 * `STORAGE_BUCKET_ALIASES` — NOT the physical bucket name. This prevents
 * clients from probing arbitrary buckets by typing a path.
 *
 * Auth: gated behind `getSession()` — unauthenticated enumeration of
 * avatar / org-logo keys is blocked at the edge. Returns 401 (no redirect)
 * so that broken <img> tags surface as missing images, not as HTML pages.
 * Bucket-level ACL (who may see which org-logo) is out of scope here and
 * must be enforced by the feature that mints the key (RBAC on org-read).
 *
 * Content-Type hardening: only `image/*` is served inline — except
 * `image/svg+xml`, which executes script when navigated to directly
 * (stored-XSS). Anything else is forced to a download via
 * `application/octet-stream` + `content-disposition: attachment`.
 */

export const GET = withEvlog(async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const session = await getSession();
	if (!session) {
		return new Response("unauthorized", { status: 401 });
	}

	const { path } = await params;
	if (!path || path.length < 2) {
		return new Response("bad request", { status: 400 });
	}
	const [alias, ...rest] = path;
	let bucket: string;
	try {
		bucket = resolveBucketAlias(alias);
	} catch {
		return new Response("not found", { status: 404 });
	}

	const key = rest.join("/");
	// Defence in depth: reject path traversal attempts before hitting S3.
	if (!key || key.includes("..")) {
		return new Response("bad request", { status: 400 });
	}

	let obj: Awaited<ReturnType<typeof getObjectStream>>;
	try {
		obj = await getObjectStream(bucket, key);
	} catch (err) {
		// Non-S3 provider selected, or S3 unreachable — upstream bad gateway.
		log.error("image-proxy upstream failed", { err });
		return new Response("bad gateway", { status: 502 });
	}
	if (!obj) return new Response("not found", { status: 404 });

	// Only safe-to-render image types are served with their real
	// Content-Type. `image/svg+xml` is excluded: an SVG navigated to
	// directly executes inline script (stored-XSS). Everything else —
	// HTML, SVG, unknown types — is forced to a download so it can never
	// be rendered in the session context.
	const contentType = obj.contentType ?? "application/octet-stream";
	// Strip parameters/casing before comparing — "image/svg+xml; charset=…"
	// must hit the download path just like a bare "image/svg+xml".
	const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	const serveInline = mime.startsWith("image/") && mime !== "image/svg+xml";

	return new Response(obj.body, {
		status: 200,
		headers: {
			"content-type": serveInline ? contentType : "application/octet-stream",
			...(serveInline ? {} : { "content-disposition": "attachment" }),
			...(obj.contentLength
				? { "content-length": String(obj.contentLength) }
				: {}),
			// Route is session-gated → never let shared CDNs cache the
			// response. Per-browser cache is fine and saves roundtrips.
			"cache-control": "private, max-age=300",
		},
	});
});
