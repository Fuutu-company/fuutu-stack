import { inviteMember } from "./procedures/invite";
import { listMembers } from "./procedures/list";
import { removeMember } from "./procedures/remove";
import { updateMemberRole } from "./procedures/update-role";

export const membersRouter = {
	list: listMembers,
	invite: inviteMember,
	updateRole: updateMemberRole,
	remove: removeMember,
};
