import { listMessagesProcedure } from "./procedures/list";
import { streamMessageProcedure } from "./procedures/stream";

export const messagesRouter = {
	list: listMessagesProcedure,
	stream: streamMessageProcedure,
};
