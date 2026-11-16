import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import type { Context } from "../context";

/**
 * Org structure changes only from a signed-in session: an API key
 * authenticates as its owner on oRPC, so without this a leaked key could
 * invite members, change roles or delete the org. The key is refused
 * before Better Auth is called.
 */

const { auth } = await import("@fuutu/auth");
const { organizationsRouter } = await import("../modules/organizations/router");

const ORG_ID = "12345678-1234-1234-8123-123456789abc";
const user = makeUser({ id: "user-1" });
const contexts = {
	"a personal key": {
		...makeSession<Context>(user),
		apiKey: { id: "key-personal", organizationId: null },
	},
	"an org key on its own org": {
		...makeSession<Context>(user),
		apiKey: { id: "key-org", organizationId: ORG_ID },
	},
} satisfies Record<string, Context>;

const KEY_REFUSED = {
	code: "FORBIDDEN",
	message: "API keys cannot perform this action",
};

const cases = [
	["create", () => organizationsRouter.create, { name: "Acme", slug: "acme" }],
	[
		"update",
		() => organizationsRouter.update,
		{ organizationId: ORG_ID, name: "Renamed" },
	],
	["delete", () => organizationsRouter.delete, { organizationId: ORG_ID }],
	[
		"members.invite",
		() => organizationsRouter.members.invite,
		{ organizationId: ORG_ID, email: "new@fuutu.local", role: "admin" },
	],
	[
		"members.updateRole",
		() => organizationsRouter.members.updateRole,
		{ organizationId: ORG_ID, memberId: "member-2", role: "owner" },
	],
	[
		"members.remove",
		() => organizationsRouter.members.remove,
		{ organizationId: ORG_ID, memberIdOrEmail: "member-2" },
	],
	[
		"invitations.revoke",
		() => organizationsRouter.invitations.revoke,
		{ organizationId: ORG_ID, invitationId: "inv-1" },
	],
] as const;

describe.each(Object.entries(contexts))(
	"organization mutations refuse %s",
	(_label, context) => {
		it.each(cases)("%s", async (_name, procedure, input) => {
			await expect(
				call(procedure() as never, input as never, { context }),
			).rejects.toMatchObject(KEY_REFUSED);
			for (const method of Object.values(auth.api)) {
				expect(method).not.toHaveBeenCalled();
			}
		});
	},
);
