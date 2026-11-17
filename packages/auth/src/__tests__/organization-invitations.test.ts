import { describe, expect, it } from "vitest";
import { hideInvitationsFromNonInviters } from "../hooks/organization-invitations";

const org = {
	id: "org-1",
	name: "Acme",
	members: [
		{ userId: "owner-1", role: "owner" },
		{ userId: "admin-1", role: "admin" },
		{ userId: "member-1", role: "member" },
	],
	invitations: [{ id: "inv-1", email: "invitee@acme.dev", status: "pending" }],
};

describe("hideInvitationsFromNonInviters", () => {
	it("empties the invitations for a plain member", () => {
		const result = hideInvitationsFromNonInviters({
			path: "/organization/get-full-organization",
			returned: org,
			userId: "member-1",
		});
		expect(result).toEqual({ ...org, invitations: [] });
	});

	it("empties them for a caller who is not in the members list", () => {
		const result = hideInvitationsFromNonInviters({
			path: "/organization/get-full-organization",
			returned: org,
			userId: "stranger",
		});
		expect(result?.invitations).toEqual([]);
	});

	it.each(["owner-1", "admin-1"])(
		"keeps them for members who may invite (%s)",
		(userId) => {
			expect(
				hideInvitationsFromNonInviters({
					path: "/organization/get-full-organization",
					returned: org,
					userId,
				}),
			).toBeNull();
		},
	);

	it("ignores other paths and non-organization results", () => {
		expect(
			hideInvitationsFromNonInviters({
				path: "/organization/list",
				returned: org,
				userId: "member-1",
			}),
		).toBeNull();
		expect(
			hideInvitationsFromNonInviters({
				path: "/organization/get-full-organization",
				returned: null,
				userId: "member-1",
			}),
		).toBeNull();
	});
});
