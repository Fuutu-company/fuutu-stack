import { featureRouter } from "../../orpc/middleware/require-feature";
import { createContactProcedure } from "./procedures/create";
import { deleteContactProcedure } from "./procedures/delete";
import { getContactProcedure } from "./procedures/get";
import { listContactsProcedure } from "./procedures/list";
import { updateContactProcedure } from "./procedures/update";

/** Off with `config.features.crm` (NOT_FOUND). */
export const crmRouter = featureRouter("crm", {
	contacts: {
		list: listContactsProcedure,
		create: createContactProcedure,
		get: getContactProcedure,
		update: updateContactProcedure,
		delete: deleteContactProcedure,
	},
});
