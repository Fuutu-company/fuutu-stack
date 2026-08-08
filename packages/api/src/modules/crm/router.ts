import { createContactProcedure } from "./procedures/create";
import { deleteContactProcedure } from "./procedures/delete";
import { getContactProcedure } from "./procedures/get";
import { listContactsProcedure } from "./procedures/list";
import { updateContactProcedure } from "./procedures/update";

export const crmRouter = {
	contacts: {
		list: listContactsProcedure,
		create: createContactProcedure,
		get: getContactProcedure,
		update: updateContactProcedure,
		delete: deleteContactProcedure,
	},
};
