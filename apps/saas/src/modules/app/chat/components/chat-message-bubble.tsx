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
					"flex size-8 shrink-0 items-center justify-center rounded-full font-medium text-xs",
					isUser
						? "bg-primary text-primary-foreground"
						: isSystem
							? "bg-muted text-muted-foreground"
							: "bg-secondary text-secondary-foreground",
				)}
			>
				{label.charAt(0)}
			</div>
			<div
				className={cn(
					"max-w-[80%] rounded-lg px-4 py-2 text-sm",
					isUser
						? "bg-primary text-primary-foreground"
						: isSystem
							? "bg-muted text-muted-foreground"
							: "bg-muted",
				)}
			>
				<div className="mb-1 font-medium text-xs opacity-70">{label}</div>
				<div className="wrap-break-word whitespace-pre-wrap">{content}</div>
			</div>
		</div>
	);
}
