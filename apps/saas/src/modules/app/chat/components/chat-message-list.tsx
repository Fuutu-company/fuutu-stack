"use client";

import { ChatMessageBubble } from "@app/chat/components/chat-message-bubble";
import { ChatStreamingText } from "@app/chat/components/chat-streaming-text";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

type ChatMessage = {
	id: string;
	role: string;
	content: string;
	createdAt: string | Date;
};

type ChatMessageListProps = {
	messages: ChatMessage[];
	stream: ReadableStream<Uint8Array> | null;
	onStreamComplete: (fullText: string) => void;
};

export function ChatMessageList({
	messages,
	stream,
	onStreamComplete,
}: ChatMessageListProps) {
	const t = useTranslations("chat");
	const endRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	if (messages.length === 0 && !stream) {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<p className="text-center text-muted-foreground text-sm">
					{t("emptyConversation")}
				</p>
			</div>
		);
	}

	return (
		<div className="flex-1 space-y-4 overflow-y-auto p-4">
			{messages.map((message) => (
				<ChatMessageBubble
					key={message.id}
					role={message.role}
					content={message.content}
				/>
			))}
			{stream && (
				<div className="flex w-full flex-row gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-secondary-foreground text-xs">
						{t("assistant").charAt(0)}
					</div>
					<div className="max-w-[80%] rounded-lg bg-muted px-4 py-2">
						<ChatStreamingText stream={stream} onComplete={onStreamComplete} />
					</div>
				</div>
			)}
			<div ref={endRef} />
		</div>
	);
}
