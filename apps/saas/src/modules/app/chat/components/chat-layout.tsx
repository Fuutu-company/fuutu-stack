"use client";

import { ChatMessageInput } from "@app/chat/components/chat-message-input";
import { ChatMessageList } from "@app/chat/components/chat-message-list";
import { ChatSidebar } from "@app/chat/components/chat-sidebar";
import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { client, orpc } from "@/utils/orpc";

const log = createLogger({ scope: "chat-layout" });

type Conversation = {
	id: string;
	title: string;
	updatedAt: string | Date;
};

type Message = {
	id: string;
	role: string;
	content: string;
	createdAt: string | Date;
};

type Org = {
	id: string;
};

const fullOrgSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
});

type FullOrg = z.infer<typeof fullOrgSchema>;

export function ChatLayout({ slug }: { slug?: string } = {}) {
	const t = useTranslations("chat");
	const queryClient = useQueryClient();
	const { data: activeOrg } = authClient.useActiveOrganization();
	const [orgBySlug, setOrgBySlug] = useState<FullOrg | null>(null);

	const loadOrg = useCallback(async () => {
		if (!slug) return;
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			const parsed = fullOrgSchema.safeParse(res.data);
			if (parsed.success) {
				setOrgBySlug(parsed.data);
			} else {
				log.error("org lookup returned unexpected shape", { slug });
			}
		} catch (error) {
			log.error("org lookup failed", { slug, error });
		}
	}, [slug]);

	useEffect(() => {
		void loadOrg();
	}, [loadOrg]);

	// Better Auth's active organization type is a superset of Org (has id, name, slug, …).
	// Narrowing to Org | null is safe — we only read org.id.
	const org = (slug ? orgBySlug : (activeOrg as Org | null)) ?? null;
	const organizationId = org?.id ?? null;

	const [activeConversationId, setActiveConversationId] = useState<
		string | null
	>(null);
	const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const loadedConversationRef = useRef<string | null>(null);

	const conversationsInput = useMemo(
		() => (organizationId ? { organizationId } : {}),
		[organizationId],
	);

	const { data: conversationsData, isPending: conversationsLoading } = useQuery(
		orpc.chat.conversations.list.queryOptions({
			input: conversationsInput,
		}),
	);

	const conversations: Conversation[] = conversationsData?.items ?? [];

	const { data: messagesData } = useQuery(
		orpc.chat.messages.list.queryOptions({
			input: { conversationId: activeConversationId ?? "" },
			enabled: !!activeConversationId,
		}),
	);

	useEffect(() => {
		const items = messagesData?.items;
		if (
			items &&
			activeConversationId &&
			loadedConversationRef.current !== activeConversationId
		) {
			loadedConversationRef.current = activeConversationId;
			setMessages(items);
		}
	}, [messagesData, activeConversationId]);

	const createConversationMutation = useMutation({
		mutationFn: async () => {
			return client.chat.conversations.create(
				organizationId ? { organizationId } : {},
			);
		},
		onSuccess: (conv) => {
			queryClient.invalidateQueries({
				queryKey: orpc.chat.conversations.list.key({
					input: conversationsInput,
				}),
			});
			setActiveConversationId(conv.id);
			setMessages([]);
		},
		onError: (error) => {
			log.error("create conversation failed", { error });
			toast.error(t("sendError"));
		},
	});

	const deleteConversationMutation = useMutation({
		mutationFn: async (id: string) => {
			return client.chat.conversations.delete({ conversationId: id });
		},
		onSuccess: (_data, deletedId) => {
			queryClient.invalidateQueries({
				queryKey: orpc.chat.conversations.list.key({
					input: conversationsInput,
				}),
			});
			if (activeConversationId === deletedId) {
				setActiveConversationId(null);
				setMessages([]);
			}
			toast.success(t("conversationDeleted"));
		},
		onError: (error) => {
			log.error("delete conversation failed", { error });
			toast.error(t("deleteError"));
		},
	});

	const sendMessageMutation = useMutation({
		mutationFn: async (content: string) => {
			if (!activeConversationId) return null;
			// TECH DEBT: raw fetch bypasses oRPC type safety — planned migration to oRPC SSE. Server-side validation via streamMessageSchema is the security boundary.
			const response = await fetch("/api/rpc/chat/messages/stream", {
				method: "POST",
				headers: { "content-type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					conversationId: activeConversationId,
					content,
				}),
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const contentType = response.headers.get("content-type");
			if (contentType && !contentType.includes("text/plain")) {
				throw new Error(`Unexpected content-type: ${contentType}`);
			}
			if (!response.body) {
				throw new Error("No response body");
			}
			return response.body as ReadableStream<Uint8Array>;
		},
		onSuccess: (body) => {
			if (body) {
				setStream(body);
			}
		},
		onError: (error) => {
			log.error("send message failed", { error });
			toast.error(t("sendError"));
		},
	});

	const handleStreamComplete = useCallback(
		(fullText: string) => {
			setStream(null);
			if (activeConversationId && fullText) {
				setMessages((prev) => [
					...prev,
					{
						id: `stream-${crypto.randomUUID()}`,
						role: "assistant",
						content: fullText,
						createdAt: new Date(),
					},
				]);
				queryClient.invalidateQueries({
					queryKey: orpc.chat.conversations.list.key({
						input: conversationsInput,
					}),
				});
			}
		},
		[activeConversationId, queryClient, conversationsInput],
	);

	const handleSend = useCallback(
		(content: string) => {
			if (!activeConversationId) return;
			setMessages((prev) => [
				...prev,
				{
					id: `user-${crypto.randomUUID()}`,
					role: "user",
					content,
					createdAt: new Date(),
				},
			]);
			sendMessageMutation.mutate(content);
		},
		[activeConversationId, sendMessageMutation],
	);

	const handleNewConversation = useCallback(() => {
		createConversationMutation.mutate();
	}, [createConversationMutation]);

	const handleDeleteConversation = useCallback(
		(id: string) => {
			deleteConversationMutation.mutate(id);
		},
		[deleteConversationMutation],
	);

	const handleSelectConversation = useCallback((id: string) => {
		setActiveConversationId(id);
		setStream(null);
	}, []);

	return (
		<div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border">
			<ChatSidebar
				conversations={conversations}
				activeId={activeConversationId}
				loading={conversationsLoading}
				onSelect={handleSelectConversation}
				onNew={handleNewConversation}
				onDelete={handleDeleteConversation}
			/>
			<div className="flex flex-1 flex-col">
				<ChatMessageList
					messages={messages}
					stream={stream}
					onStreamComplete={handleStreamComplete}
				/>
				<ChatMessageInput
					onSend={handleSend}
					disabled={
						!activeConversationId ||
						sendMessageMutation.isPending ||
						stream !== null
					}
				/>
			</div>
		</div>
	);
}
