import { db } from "../client";

export type ChatConversationWithMessages = Awaited<
	ReturnType<typeof getConversation>
>;

export const createConversation = (
	userId: string,
	organizationId?: string | null,
	title?: string,
) =>
	db.chatConversation.create({
		data: {
			userId,
			organizationId: organizationId ?? null,
			title,
		},
	});

export const listConversations = (
	userId: string,
	organizationId?: string | null,
	opts: { take?: number; skip?: number } = {},
) => {
	const { take = 50, skip = 0 } = opts;
	if (organizationId) {
		return db.chatConversation.findMany({
			where: { userId, organizationId },
			orderBy: { updatedAt: "desc" },
			take,
			skip,
		});
	}
	return db.chatConversation.findMany({
		where: { userId, organizationId: null },
		orderBy: { updatedAt: "desc" },
		take,
		skip,
	});
};

export const countConversations = (
	userId: string,
	organizationId?: string | null,
) => {
	if (organizationId) {
		return db.chatConversation.count({
			where: { userId, organizationId },
		});
	}
	return db.chatConversation.count({
		where: { userId, organizationId: null },
	});
};

export const getConversation = async (id: string, userId: string) => {
	const owned = await db.chatConversation.findFirst({
		where: { id, userId },
		include: { messages: { orderBy: { createdAt: "asc" } } },
	});
	return owned;
};

export const deleteConversation = async (id: string, userId: string) => {
	const owned = await db.chatConversation.findFirst({
		where: { id, userId },
	});
	if (!owned) return null;
	return db.chatConversation.delete({ where: { id } });
};

export const addMessage = async (
	conversationId: string,
	userId: string,
	role: string,
	content: string,
) => {
	const owned = await db.chatConversation.findFirst({
		where: { id: conversationId, userId },
	});
	if (!owned) return null;
	return db
		.$transaction([
			db.chatMessage.create({
				data: { conversationId, role, content },
			}),
			db.chatConversation.update({
				where: { id: conversationId },
				data: { updatedAt: new Date() },
			}),
		])
		.then(([message]) => message);
};

export const listMessages = async (
	conversationId: string,
	userId: string,
	opts: { take?: number; skip?: number } = {},
) => {
	const owned = await db.chatConversation.findFirst({
		where: { id: conversationId, userId },
	});
	if (!owned) return null;
	const { take = 50, skip = 0 } = opts;
	return db.chatMessage.findMany({
		where: { conversationId },
		orderBy: { createdAt: "asc" },
		take,
		skip,
	});
};

export const countMessages = (conversationId: string) =>
	db.chatMessage.count({ where: { conversationId } });

export const updateConversationTitle = async (
	id: string,
	userId: string,
	title: string,
) => {
	const owned = await db.chatConversation.findFirst({
		where: { id, userId },
	});
	if (!owned) return null;
	return db.chatConversation.update({
		where: { id },
		data: { title },
	});
};
