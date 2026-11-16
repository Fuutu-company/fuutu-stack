/**
 * Profile input the kit renders to other people (admins, org members):
 * names are capped, and avatar / logo URLs may only point at the owner's
 * own uploads behind `/image-proxy` — never a third-party URL that tracks
 * whoever views it. `hooks.before` guard for Better Auth's sign-up,
 * profile and organization endpoints (HTTP and `auth.api.*` alike).
 */
import { APIError } from "better-auth/api";

export const MAX_PROFILE_NAME_LENGTH = 100;

/** One or more key segments; none may start with a dot (no `..`). */
const OBJECT_KEY =
	/^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
const MAX_IMAGE_URL_LENGTH = 2048;

type SessionLookup = () => Promise<{
	user: { id: string };
	session: { activeOrganizationId?: string | null };
} | null>;

type Body = Record<string, unknown>;

function invalid(message: string): APIError {
	return new APIError("BAD_REQUEST", {
		message,
		code: "INVALID_PROFILE_INPUT",
	});
}

function assertName(name: unknown): void {
	if (typeof name === "string" && name.length > MAX_PROFILE_NAME_LENGTH) {
		throw invalid(`Name must be at most ${MAX_PROFILE_NAME_LENGTH} characters`);
	}
}

/** `/image-proxy/<alias>/<ownerId>/<key>` with a safe object key. */
function isOwnUpload(
	url: string,
	alias: "avatars" | "organization-logos",
	ownerId: string | null | undefined,
): boolean {
	if (!ownerId || url.length > MAX_IMAGE_URL_LENGTH) return false;
	const prefix = `/image-proxy/${alias}/${ownerId}/`;
	return url.startsWith(prefix) && OBJECT_KEY.test(url.slice(prefix.length));
}

const asBody = (value: unknown): Body =>
	typeof value === "object" && value !== null ? (value as Body) : {};

/**
 * Throws `APIError("BAD_REQUEST")` (code `INVALID_PROFILE_INPUT`) for a
 * name over `MAX_PROFILE_NAME_LENGTH` or an image / logo that is not
 * null or the owner's own upload. The session is read only to check an
 * image or logo.
 */
export async function assertProfileInput(input: {
	path: string | undefined;
	body: unknown;
	getSession: SessionLookup;
}): Promise<void> {
	const body = asBody(input.body);
	switch (input.path) {
		case "/sign-up/email": {
			assertName(body.name);
			if (body.image != null) throw invalid("Image is not allowed here");
			return;
		}
		case "/update-user": {
			assertName(body.name);
			if (body.image == null) return;
			const session = await input.getSession();
			if (
				typeof body.image !== "string" ||
				!isOwnUpload(body.image, "avatars", session?.user.id)
			) {
				throw invalid("Image must be one of your own uploads");
			}
			return;
		}
		case "/organization/create": {
			assertName(body.name);
			if (body.logo != null) throw invalid("Logo is not allowed here");
			return;
		}
		case "/organization/update": {
			const data = asBody(body.data);
			assertName(data.name);
			if (data.logo == null) return;
			const organizationId =
				typeof body.organizationId === "string"
					? body.organizationId
					: (await input.getSession())?.session.activeOrganizationId;
			if (
				typeof data.logo !== "string" ||
				!isOwnUpload(data.logo, "organization-logos", organizationId)
			) {
				throw invalid("Logo must be one of the organization's uploads");
			}
			return;
		}
		default:
			return;
	}
}
