import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The organization invitation email — one function for the org plugin's
 * `sendInvitationEmail` and the support back office's resend.
 */

vi.mock("@fuutu/env/saas", () => ({
	env: { NEXT_PUBLIC_SAAS_URL: "https://app.example.test" },
}));

vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));

const { sendEmail } = await import("../lib/email");
const { sendOrganizationInvitationEmail } = await import(
	"../lib/invitation-email"
);

beforeEach(() => {
	vi.mocked(sendEmail).mockReset();
	vi.mocked(sendEmail).mockResolvedValue(undefined);
});

describe("sendOrganizationInvitationEmail", () => {
	it("sends the organization-invitation template with the accept link", async () => {
		await expect(
			sendOrganizationInvitationEmail({
				email: "new@acme.test",
				invitationId: "inv-1",
				organizationName: "Acme",
				inviterName: "Grace",
				locale: "de",
			}),
		).resolves.toBe(true);
		expect(sendEmail).toHaveBeenCalledWith({
			to: "new@acme.test",
			template: "organization-invitation",
			data: {
				organizationName: "Acme",
				inviteUrl: "https://app.example.test/auth/accept-invitation?id=inv-1",
				inviterName: "Grace",
				locale: "de",
			},
		});
	});

	it("never throws on a delivery failure and reports it", async () => {
		vi.mocked(sendEmail).mockRejectedValueOnce(new Error("smtp down"));
		await expect(
			sendOrganizationInvitationEmail({
				email: "new@acme.test",
				invitationId: "inv-1",
				organizationName: "Acme",
			}),
		).resolves.toBe(false);
	});
});
