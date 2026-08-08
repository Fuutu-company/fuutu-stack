import { listInvitations } from "./procedures/list";
import { revokeInvitation } from "./procedures/revoke";

export const invitationsRouter = {
	list: listInvitations,
	revoke: revokeInvitation,
};
