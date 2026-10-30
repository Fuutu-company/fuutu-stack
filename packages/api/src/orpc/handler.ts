import { config, KIT_VERSION } from "@fuutu/config";
import { createLogger } from "@fuutu/logs";
import { withEvlog } from "@fuutu/logs/orpc";
import type { OpenAPI } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { getBetterAuthSpecPaths } from "./openapi-merge";
import { router } from "./router";

const log = createLogger({ scope: "rpc-handler" });

// withEvlog wraps .handle() so each matched request emits a single evlog
// wide event (method/path/status/duration/requestId) and injects
// `context.log` into the procedure context — the `evlog()` middleware on
// publicProcedure then adds `operation` (the procedure path) to the event.
export const rpcHandler = withEvlog(
	new RPCHandler(router, {
		clientInterceptors: [
			onError((error) => {
				log.error("[RPC Error]", { err: error });
			}),
		],
	}),
);

export const openApiHandler = withEvlog(
	new OpenAPIHandler(router, {
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
				specGenerateOptions: async () => {
					const betterAuthPaths = await getBetterAuthSpecPaths();
					return {
						info: {
							title: `${config.app.name} API`,
							version: KIT_VERSION,
							description: "Type-safe API built with oRPC",
						},
						servers: [{ url: "/api" }],
						paths: betterAuthPaths as OpenAPI.PathsObject,
					};
				},
				docsPath: "/docs",
			}),
		],
		clientInterceptors: [
			onError((error) => {
				log.error("[OpenAPI Error]", { err: error });
			}),
		],
	}),
);
