import { createLogger } from "@fuutu/logs";
import { withEvlog } from "@fuutu/logs/orpc";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import { router } from "./router";

const log = createLogger({ scope: "rpc-handler" });

// withEvlog wraps .handle() so each matched request emits a single evlog
// wide event (method/path/status/duration/requestId) and injects
// `context.log` into the procedure context — the `evlog()` middleware on
// publicProcedure then adds `operation` (the procedure path) to the event.
export const rpcHandler = withEvlog(
	new RPCHandler(router, {
		// `context.resHeaders` — procedures that call Better Auth with
		// `returnHeaders: true` forward its Set-Cookie (impersonation).
		plugins: [new ResponseHeadersPlugin()],
		clientInterceptors: [
			onError((error) => {
				log.error("[RPC Error]", { err: error });
			}),
		],
	}),
);

// The reference UI and spec (`/api/docs`, `/api/spec.json`) are served
// from a document built once per process — see ./api-docs.ts.
export const openApiHandler = withEvlog(
	new OpenAPIHandler(router, {
		plugins: [new ResponseHeadersPlugin()],
		clientInterceptors: [
			onError((error) => {
				log.error("[OpenAPI Error]", { err: error });
			}),
		],
	}),
);
