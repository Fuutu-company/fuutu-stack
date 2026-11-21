import { ORPCError } from "@orpc/server";
import type { Context } from "../../context";

/**
 * `desktop.*` answers the desktop app (its OAuth token) or the signed-in
 * browser — never an API key: an org-pinned key must not read the owner's
 * other organizations or obtain an offline claim.
 */
export function assertDesktopCaller(
	context: Pick<Context, "apiKey" | "desktop">,
) {
	if (context.apiKey && !context.desktop) {
		throw new ORPCError("FORBIDDEN", { message: "Not available for API keys" });
	}
}
