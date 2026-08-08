"use client";

import { Button, Textarea } from "@fuutu/ui";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

type ChatMessageInputProps = {
	onSend: (content: string) => void;
	disabled: boolean;
};

export function ChatMessageInput({ onSend, disabled }: ChatMessageInputProps) {
	const t = useTranslations("chat");
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	function handleSend() {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
		setValue(e.target.value);
		const el = e.target;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
	}

	return (
		<div className="border-t p-4">
			<div className="flex items-end gap-2">
				<Textarea
					ref={textareaRef}
					value={value}
					onChange={handleInput}
					onKeyDown={handleKeyDown}
					placeholder={t("messagePlaceholder")}
					disabled={disabled}
					rows={1}
					className="max-h-50 min-h-10 resize-none"
				/>
				<Button
					size="icon"
					onClick={handleSend}
					disabled={disabled || !value.trim()}
					title={t("sendMessage")}
				>
					<Send className="size-4" />
				</Button>
			</div>
		</div>
	);
}
