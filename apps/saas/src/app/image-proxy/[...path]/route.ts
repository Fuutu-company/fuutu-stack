import { getObjectStream, storageConfig } from "@fuutu/storage";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth-server";

/**
 * Image proxy for private buckets.
 *
 * Fronts the `@fuutu/storage` provider so the browser never gets a
 * signed URL (those leak bucket paths, expiry timestamps and the real
 * storage host). The URL shape is deliberately short and stable:
 *
 *     /image-proxy/<bucket-alias>/<...object-key>
 *
 * where `<bucket-alias>` is one of the logical names defined in
 * `storageConfig.buckets` — NOT the physical bucket name. This prevents
 * clients from probing arbitrary buckets by typing a path.
 *
 * Auth: gated behind `getSession()` — unauthenticated enumeration of
 * avatar / org-logo keys is blocked at the edge. Returns 401 (no redirect)
 * so that broken <img> tags surface as missing images, not as HTML pages.
 * Bucket-level ACL (who may see which org-logo) is out of scope here and
 * must be enforced by the feature that mints the key (RBAC on org-read).
 */
const ALIAS_TO_BUCKET: Record<string, string> = {
	avatars: storageConfig.buckets.avatars,
	"organization-logos": storageConfig.buckets.organizationLogos,
};

export async function GET(
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
	const bucket = ALIAS_TO_BUCKET[alias];
	if (!bucket) return new Response("not found", { status: 404 });

	const key = rest.join("/");
	// Defence in depth: reject path traversal attempts before hitting S3.
	if (!key || key.includes("..")) {
		return new Response("bad request", { status: 400 });
	}

	let obj: Awaited<ReturnType<typeof getObjectStream>>;
	try {
		obj = await getObjectStream(bucket, key);
	} catch {
		// Non-S3 provider selected, or S3 unreachable — upstream bad gateway.
		return new Response("bad gateway", { status: 502 });
	}
	if (!obj) return new Response("not found", { status: 404 });

	return new Response(obj.body, {
		status: 200,
		headers: {
			"content-type": obj.contentType ?? "application/octet-stream",
			...(obj.contentLength
				? { "content-length": String(obj.contentLength) }
				: {}),
			// Route is session-gated → never let shared CDNs cache the
			// response. Per-browser cache is fine and saves roundtrips.
			"cache-control": "private, max-age=300",
		},
	});
}
