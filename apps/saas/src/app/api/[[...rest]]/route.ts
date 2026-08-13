import { app } from "@fuutu/api";
import type { NextRequest } from "next/server";

/**
 * Catch-all API route handler
 *
 * Handles all /api/* requests and forwards them to the Hono app:
 * - /api/auth/** → Better Auth handler
 * - /api/rpc/** → oRPC handler
 * - /api/docs → OpenAPI documentation (Scalar UI)
 * - /api/spec.json → OpenAPI specification JSON
 * - /api/health → Health check
 *
 * catch-all route handles all backend requests.
 */
async function handler(request: NextRequest) {
	return app.fetch(request);
}

export {
	handler as GET,
	handler as POST,
	handler as PUT,
	handler as PATCH,
	handler as DELETE,
	handler as OPTIONS,
};
