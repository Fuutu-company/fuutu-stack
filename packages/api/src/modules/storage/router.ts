import { createPresigned } from "./procedures/create-presigned";
import { deleteObject } from "./procedures/delete";
import { listObjectsProcedure } from "./procedures/get";

export const storageRouter = {
	upload: {
		createPresigned,
	},
	file: {
		delete: deleteObject,
		list: listObjectsProcedure,
	},
};
