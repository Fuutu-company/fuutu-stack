"use client";

import { ChatMessageInput } from "@app/chat/components/chat-message-input";
import { ChatMessageList } from "@app/chat/components/chat-message-list";
import { ChatSidebar } from "@app/chat/components/chat-sidebar";
import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import {
	Button,
	Card,
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@fuutu/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useFullOrganization } from "@/modules/app/organizations/use-full-organization";
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

export function ChatLayout({ slug }: { slug?: string } = {}) {
	const t = useTranslations("chat");
	const queryClient = useQueryClient();
	// Unscoped route: the session's active org. Read from the (shared)
	// session instead of useActiveOrganization(), which refetches
	// get-full-organization on every mount — only the id is needed.
	const { data: session } = authClient.useSession();
	const activeOrgId = (
		session?.session as { activeOrganizationId?: string | null } | undefined
	)?.activeOrganizationId;
	const parsedOrg = fullOrgSchema.safeParse(useFullOrganization(slug).data);
	const orgBySlug = parsedOrg.success ? parsedOrg.data : null;

	const org: Org | null = slug
		? orgBySlug
		: activeOrgId
			? { id: activeOrgId }
			: null;
	const organizationId = org?.id ?? null;

	const [activeConversationId, setActiveConversationId] = useState<
		string | null
	>(null);
	const [listOpen, setListOpen] = useState(false);
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
					json: {
						conversationId: activeConversationId,
						content,
					},
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
		setListOpen(false);
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
		setListOpen(false);
	}, []);

	return (
		<Card className="h-[calc(100dvh-9rem)] min-h-[28rem] flex-row gap-0 overflow-hidden py-0">
			<ChatSidebar
				className="hidden md:flex"
				conversations={conversations}
				activeId={activeConversationId}
				loading={conversationsLoading}
				onSelect={handleSelectConversation}
				onNew={handleNewConversation}
				onDelete={handleDeleteConversation}
			/>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-center gap-2 border-b p-2 md:hidden">
					<Sheet open={listOpen} onOpenChange={setListOpen}>
						<SheetTrigger asChild>
							<Button variant="outline" size="sm">
								<MessageSquare className="mr-2 size-4" />
								{t("conversations")}
							</Button>
						</SheetTrigger>
						<SheetContent
							side="left"
							closeLabel={t("closeConversations")}
							aria-describedby={undefined}
							className="w-72 gap-0 p-0"
						>
							<SheetTitle className="p-4 pb-0">{t("conversations")}</SheetTitle>
							<ChatSidebar
								className="w-full border-r-0"
								conversations={conversations}
								activeId={activeConversationId}
								loading={conversationsLoading}
								onSelect={handleSelectConversation}
								onNew={handleNewConversation}
								onDelete={handleDeleteConversation}
							/>
						</SheetContent>
					</Sheet>
					<Button
						size="icon-sm"
						aria-label={t("newConversation")}
						onClick={handleNewConversation}
					>
						<Plus className="size-4" />
					</Button>
				</div>
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
		</Card>
	);
}
