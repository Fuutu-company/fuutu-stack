import { ORPCError } from "@orpc/server";
import type { ApiKeyAuth } from "../../context";

/**
 * API-key management is session-only: a key reaching oRPC authenticates as
 * its owner, and letting it mint (wider-scoped) keys or revoke the owner's
 * other keys would turn one leaked key into a persistent foothold.
 */
export function assertSessionCaller(context: {
	apiKey: Pick<ApiKeyAuth, "id"> | null;
}): void {
	if (context.apiKey) {
		throw new ORPCError("FORBIDDEN", {
			message: "API keys cannot manage API keys",
		});
	}
}
