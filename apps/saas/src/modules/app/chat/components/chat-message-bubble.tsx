"use client";

import { cn } from "@fuutu/ui";
import { useTranslations } from "next-intl";

type ChatMessageBubbleProps = {
	role: string;
	content: string;
};

export function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
	const t = useTranslations("chat");

	const isUser = role === "user";
	const isSystem = role === "system";

	const label = isUser ? t("you") : isSystem ? t("system") : t("assistant");

	return (
		<div
			className={cn(
				"flex w-full gap-3",
				isUser ? "flex-row-reverse" : "flex-row",
			)}
		>
			<div
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-xs",
					isUser
						? "bg-primary text-primary-foreground"
						: isSystem
							? "bg-muted text-muted-foreground"
							: "bg-area-ai text-area-ai-foreground",
				)}
			>
				{label.charAt(0)}
			</div>
			<div
				className={cn(
					"max-w-[80%] rounded-3xl px-4 py-2.5 text-sm leading-6",
					isUser
						? "bg-primary text-primary-foreground"
						: isSystem
							? "bg-muted text-muted-foreground"
							: "bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10",
				)}
			>
				<div className="mb-0.5 font-bold text-xs opacity-75">{label}</div>
				<div className="wrap-break-word whitespace-pre-wrap">{content}</div>
			</div>
		</div>
	);
}
