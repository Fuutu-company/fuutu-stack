import { conversationsRouter } from "./conversations/router";
import { messagesRouter } from "./messages/router";

export const chatRouter = {
	conversations: conversationsRouter,
	messages: messagesRouter,
};
