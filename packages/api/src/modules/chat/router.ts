import { featureRouter } from "../../orpc/middleware/require-feature";
import { conversationsRouter } from "./conversations/router";
import { messagesRouter } from "./messages/router";

/** Off with `config.features.aiChat` (NOT_FOUND). */
export const chatRouter = featureRouter("aiChat", {
	conversations: conversationsRouter,
	messages: messagesRouter,
});
