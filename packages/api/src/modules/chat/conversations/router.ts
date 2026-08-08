import { createConversationProcedure } from "./procedures/create";
import { deleteConversationProcedure } from "./procedures/delete";
import { listConversationsProcedure } from "./procedures/list";

export const conversationsRouter = {
	list: listConversationsProcedure,
	create: createConversationProcedure,
	delete: deleteConversationProcedure,
};
