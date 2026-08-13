import { config } from "@fuutu/config";
import { createLogger } from "@fuutu/logs";
import type { OpenAPI } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { getBetterAuthSpecPaths } from "./openapi-merge";
import { router } from "./router";

const log = createLogger({ scope: "rpc-handler" });

export const rpcHandler = new RPCHandler(router, {
	clientInterceptors: [
		onError((error) => {
			log.error("[RPC Error]", { err: error });
		}),
	],
});

export const openApiHandler = new OpenAPIHandler(router, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
			specGenerateOptions: async () => {
				const betterAuthPaths = await getBetterAuthSpecPaths();
				return {
					info: {
						title: `${config.app.name} API`,
						version: "1.0.0",
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
});

export function createRPCHandler() {
	return rpcHandler;
}

export function createOpenAPIHandler() {
	return openApiHandler;
}
