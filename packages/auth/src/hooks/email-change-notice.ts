/**
 * "Your email address was changed" notice to the previous address once
 * an email change is complete — so a takeover that moved the account to
 * another mailbox does not go unnoticed. `hooks.after` on
 * `/verify-email`: only a valid `change-email-verification` token (signed
 * with the auth secret) whose verification succeeded triggers it.
 * Best-effort: a mail failure never undoes the change.
 */
import { getUserByEmail } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { verifyJWT } from "better-auth/crypto";
import { sendEmail } from "../lib/email";

const log = createLogger({ scope: "auth:email-change" });

/** Error answers and redirects that carry `?error=` are failures. */
function succeeded(returned: unknown): boolean {
	if (!(returned instanceof Error) || !("statusCode" in returned)) {
		return returned != null;
	}
	if (returned.statusCode !== 302) return false;
	const headers = "headers" in returned ? returned.headers : undefined;
	const location = headers instanceof Headers ? headers.get("location") : null;
	if (!location) return false;
	return !new URL(location, "http://local").searchParams.has("error");
}

export async function notifyPreviousEmailAfterChange(input: {
	path: string | undefined;
	token: unknown;
	returned: unknown;
	secret: string;
}): Promise<void> {
	if (input.path !== "/verify-email" || typeof input.token !== "string") {
		return;
	}
	if (!succeeded(input.returned)) return;
	const payload = await verifyJWT<{
		email?: unknown;
		updateTo?: unknown;
		requestType?: unknown;
	}>(input.token, input.secret);
	if (
		payload?.requestType !== "change-email-verification" ||
		typeof payload.email !== "string" ||
		typeof payload.updateTo !== "string"
	) {
		return;
	}
	try {
		const user = await getUserByEmail(payload.updateTo);
		if (!user) return;
		await sendEmail({
			to: payload.email,
			template: "email-changed",
			data: {
				name: user.name,
				newEmail: payload.updateTo,
				locale: user.locale ?? undefined,
			},
		});
	} catch (err) {
		log.error("email changed notice failed", { err: String(err) });
	}
}
