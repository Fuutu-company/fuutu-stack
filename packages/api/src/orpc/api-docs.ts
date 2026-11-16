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
				specGenerateOptions: () => getApiSpec(),
			}),
		],
	},
);

type RenderedDocs = { body: string; contentType: string };

const rendered = new Map<ApiDocsPath, Promise<RenderedDocs | null>>();

async function renderApiDocs(path: ApiDocsPath): Promise<RenderedDocs | null> {
	// The output does not depend on the request (servers is the relative
	// `/api`), so a fixed origin renders the shared copy.
	const { matched, response } = await referenceHandler.handle(
		new Request(`http://localhost/api${path}`),
		{ prefix: "/api", context: {} },
	);
	if (!matched) return null;
	return {
		body: await response.text(),
		contentType: response.headers.get("content-type") ?? "text/plain",
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
		},
	});
}
