import { createApiKeyProcedure } from "./procedures/create";
import { deleteApiKeyProcedure } from "./procedures/delete";
import { listApiKeysProcedure } from "./procedures/list";
import { revokeApiKeyProcedure } from "./procedures/revoke";

export const apiKeysRouter = {
	create: createApiKeyProcedure,
	list: listApiKeysProcedure,
	revoke: revokeApiKeyProcedure,
	delete: deleteApiKeyProcedure,
};
