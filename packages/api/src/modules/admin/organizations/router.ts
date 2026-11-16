import { cancelInvitationProcedure } from "./procedures/cancel-invitation";
import { deleteOrganizationProcedure } from "./procedures/delete";
import { getOrganizationProcedure } from "./procedures/get";
import { listOrganizationsProcedure } from "./procedures/list";
import { removeMemberProcedure } from "./procedures/remove-member";
import { renameOrganizationProcedure } from "./procedures/rename";
import { resendInvitationProcedure } from "./procedures/resend-invitation";
import { transferOwnershipProcedure } from "./procedures/transfer-ownership";
import { updateMemberRoleProcedure } from "./procedures/update-member-role";

export const adminOrganizationsRouter = {
	list: listOrganizationsProcedure,
	get: getOrganizationProcedure,
	rename: renameOrganizationProcedure,
	updateMemberRole: updateMemberRoleProcedure,
	removeMember: removeMemberProcedure,
	transferOwnership: transferOwnershipProcedure,
	resendInvitation: resendInvitationProcedure,
	cancelInvitation: cancelInvitationProcedure,
	delete: deleteOrganizationProcedure,
};
