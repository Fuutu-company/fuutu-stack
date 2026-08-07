import { invitationsRouter } from "./invitations/router";
import { membersRouter } from "./members/router";
import { createOrganization } from "./procedures/create";
import { deleteOrganization } from "./procedures/delete";
import { getOrganization } from "./procedures/get";
import { listOrganizations } from "./procedures/list";
import { updateOrganization } from "./procedures/update";

export const organizationsRouter = {
	list: listOrganizations,
	get: getOrganization,
	create: createOrganization,
	update: updateOrganization,
	delete: deleteOrganization,
	members: membersRouter,
	invitations: invitationsRouter,
};
