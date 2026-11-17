import { createHash } from "node:crypto";
import { config } from "@fuutu/config";
import { APP_VERSION } from "@fuutu/config/app-version";
import { type OpenAPI, OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
	getBetterAuthSpecPaths,
	getBetterAuthSpecSchemas,
} from "./openapi-merge";
import { router } from "./router";

/** Docs paths below `/api`, as the Hono routes in `app.ts` mount them. */
export type ApiDocsPath = "/docs" | "/spec.json";

/** Browsers and CDNs may keep the docs this long (seconds). */
const DOCS_MAX_AGE = 300;

/**
 * The Scalar bundle `/api/docs` loads, pinned with Subresource Integrity —
 * a changed CDN file is refused instead of run. Bump both together; the
 * hash of `dist/browser/standalone.js` from the npm tarball:
 * `openssl dgst -sha384 -binary standalone.js | openssl base64 -A`.
 */
export const SCALAR_SCRIPT = {
	url: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.4/dist/browser/standalone.js",
	integrity:
		"sha384-hwB9WroDTpZaI38gr+u9CXA6ksz5gUYgD2GxXazKl/agT1L2GWUiRFWGJYNiFu4Q",
} as const;

let spec: Promise<OpenAPI.Document> | null = null;

/**
 * The merged OpenAPI document (oRPC procedures + Better Auth), built once
 * per process — it only changes with a deploy. The Better Auth part is
 * fetched once too (`openapi-merge.ts`), a failure included.
 */
export function getApiSpec(): Promise<OpenAPI.Document> {
	if (!spec) {
		spec = buildApiSpec();
		spec.catch(() => {
			spec = null;
		});
	}
	return spec;
}

async function buildApiSpec(): Promise<OpenAPI.Document> {
	const [betterAuthPaths, betterAuthSchemas] = await Promise.all([
		getBetterAuthSpecPaths(),
		getBetterAuthSpecSchemas(),
	]);
	const generator = new OpenAPIGenerator({
		schemaConverters: [new ZodToJsonSchemaConverter()],
	});
	return generator.generate(router, {
		info: {
			title: `${config.app.name} API`,
			version: APP_VERSION,
			description: "Type-safe API built with oRPC",
		},
		servers: [{ url: "/api" }],
		paths: betterAuthPaths as OpenAPI.PathsObject,
		components: {
			schemas: betterAuthSchemas as Record<string, OpenAPI.SchemaObject>,
		},
	});
}

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

/** JSON that cannot close the surrounding `<script>` (oRPC's escaping). */
const jsonForScript = (value: unknown) =>
	JSON.stringify(value)
		.replace(/&/g, "\\u0026")
		.replace(/'/g, "\\u0027")
		.replace(/</g, "\\u003C")
		.replace(/>/g, "\\u003E")
		.replace(/\//g, "\\u002F");

/**
 * The sandboxed page has an opaque origin, where reading Web Storage
 * throws — Scalar keeps its UI settings there and would not start.
 * In-memory stand-ins, gone with the tab.
 */
const STORAGE_SHIM = `(() => {
for (const name of ["localStorage", "sessionStorage"]) {
const data = new Map();
const storage = {
get length() { return data.size; },
key: (i) => [...data.keys()][i] ?? null,
getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
setItem: (k, v) => { data.set(String(k), String(v)); },
removeItem: (k) => { data.delete(String(k)); },
clear: () => { data.clear(); },
};
Object.defineProperty(window, name, { value: storage, configurable: true });
}
})();`;

/** The inline bootstrap script. Inline script hashes go into the docs CSP. */
const scalarBootstrap = (spec: OpenAPI.Document) =>
	`const scalarConfig = ${jsonForScript({ content: JSON.stringify(spec) })};
Scalar.createApiReference("#app", scalarConfig);`;

function renderScalarHtml(
	_specUrl: string,
	title: string,
	_head: string,
	_scriptUrl: string,
	_config: Record<string, unknown> | undefined,
	spec: OpenAPI.Document,
): string {
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body>
<div id="app"></div>
<script>${STORAGE_SHIM}</script>
<script src="${escapeHtml(SCALAR_SCRIPT.url)}" integrity="${SCALAR_SCRIPT.integrity}" crossorigin="anonymous"></script>
<script>${scalarBootstrap(spec)}</script>
</body>
</html>
`;
}

/**
 * Route-scoped CSP for `/api/docs` (the sitewide one in
 * `apps/saas/next.config.ts` skips this path). `sandbox` without
 * `allow-same-origin` runs the third-party UI at an opaque origin: no
 * access to the app's cookies, storage or same-origin API calls.
 */
function docsCsp(html: string): string {
	const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(m) =>
			`'sha256-${createHash("sha256")
				.update(m[1] ?? "")
				.digest("base64")}'`,
	);
	return [
		"default-src 'none'",
		`script-src ${SCALAR_SCRIPT.url} ${inline.join(" ")}`,
		"style-src 'unsafe-inline'",
		"font-src data: https://fonts.scalar.com",
		"img-src data: blob: https:",
		"connect-src 'self'",
		"frame-ancestors 'none'",
		"base-uri 'none'",
		"form-action 'none'",
		"object-src 'none'",
		"sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads",
	].join("; ");
}

/**
 * Renders the reference UI and the spec file from the prebuilt document —
 * an empty router, so oRPC only wraps the spec instead of converting every
 * procedure's schemas again.
 */
const referenceHandler = new OpenAPIHandler(
	{},
	{
		plugins: [
			new OpenAPIReferencePlugin({
				docsPath: "/docs",
				docsScriptUrl: SCALAR_SCRIPT.url,
				renderDocsHtml: renderScalarHtml,
				specGenerateOptions: () => getApiSpec(),
			}),
		],
	},
);

type RenderedDocs = { body: string; contentType: string; csp?: string };

const rendered = new Map<ApiDocsPath, Promise<RenderedDocs | null>>();

async function renderApiDocs(path: ApiDocsPath): Promise<RenderedDocs | null> {
	// The output does not depend on the request (servers is the relative
	// `/api`), so a fixed origin renders the shared copy.
	const { matched, response } = await referenceHandler.handle(
		new Request(`http://localhost/api${path}`),
		{ prefix: "/api", context: {} },
	);
	if (!matched) return null;
	const body = await response.text();
	return {
		body,
		contentType: response.headers.get("content-type") ?? "text/plain",
		csp: path === "/docs" ? docsCsp(body) : undefined,
	};
}

/** The `/api/docs` or `/api/spec.json` response, rendered once per process. */
export async function serveApiDocs(path: ApiDocsPath): Promise<Response> {
	let docs = rendered.get(path);
	if (!docs) {
		docs = renderApiDocs(path);
		rendered.set(path, docs);
		// A failed render (a bug, not input) is not kept — the next request
		// tries again; the per-IP rate limit bounds the retries.
		docs.catch(() => rendered.delete(path));
	}
	const result = await docs;
	if (!result) return new Response("Not Found", { status: 404 });
	return new Response(result.body, {
		status: 200,
		headers: {
			"content-type": result.contentType,
			"cache-control": `public, max-age=${DOCS_MAX_AGE}`,
			...(result.csp ? { "content-security-policy": result.csp } : {}),
		},
	});
}
