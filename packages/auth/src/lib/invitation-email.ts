/**
 * The organization invitation email — sent by the org plugin's
 * `sendInvitationEmail` and by the support back office's resend
 * (`admin-support.ts`), so both deliver the same message.
 */
import { createLogger } from "@fuutu/logs";
import { sendEmail } from "./email";
import { saasBaseUrl } from "./saas-url";

const log = createLogger({ scope: "auth" });

export type OrganizationInvitationEmail = {
	email: string;
	invitationId: string;
	organizationName: string;
	inviterName?: string;
	locale?: string;
};

/**
 * Sends the `organization-invitation` template with the accept link.
 * A delivery failure is logged, never thrown — an invitation must not
 * fail on the mail provider. Returns whether the email went out.
 */
export async function sendOrganizationInvitationEmail(
	input: OrganizationInvitationEmail,
): Promise<boolean> {
	const inviteUrl = `${saasBaseUrl}/auth/accept-invitation?id=${input.invitationId}`;
	try {
		await sendEmail({
			to: input.email,
			template: "organization-invitation",
			data: {
				organizationName: input.organizationName,
				inviteUrl,
				inviterName: input.inviterName,
				locale: input.locale,
			},
		});
		return true;
	} catch (err) {
		log.error("invitation email failed", { err: String(err) });
		return false;
	}
}
