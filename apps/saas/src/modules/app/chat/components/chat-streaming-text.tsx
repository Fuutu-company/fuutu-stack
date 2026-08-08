"use client";

import { createLogger } from "@fuutu/logs";
import { useEffect, useRef, useState } from "react";

const log = createLogger({ scope: "chat-stream" });

type ChatStreamingTextProps = {
	stream: ReadableStream<Uint8Array> | null;
	onComplete: (fullText: string) => void;
};

export function ChatStreamingText({
	stream,
	onComplete,
}: ChatStreamingTextProps) {
	const [text, setText] = useState("");
	const completedRef = useRef(false);

	useEffect(() => {
		if (!stream) return;
		setText("");
		completedRef.current = false;

		let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
		try {
			reader = stream.getReader();
		} catch {
			return;
		}
		const decoder = new TextDecoder();
		let full = "";
		let cancelled = false;

		async function pump(): Promise<void> {
			if (!reader) return;
			try {
				const { done, value } = await reader.read();
				if (cancelled) return;
				if (done) {
					if (!completedRef.current) {
						completedRef.current = true;
						onComplete(full);
					}
					return;
				}
				full += decoder.decode(value, { stream: true });
				setText(full);
				await pump();
			} catch (e) {
				if (cancelled) return;
				log.error("stream pump failed", { err: e });
				if (!completedRef.current) {
					completedRef.current = true;
					onComplete(full);
				}
			}
		}
		void pump();

		return () => {
			cancelled = true;
			reader?.cancel().catch((err) => {
				log.warn("stream reader cancelled", { err });
			});
		};
	}, [stream, onComplete]);

	return (
		<div className="wrap-break-word whitespace-pre-wrap text-sm">
			{text}
			<span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle" />
		</div>
	);
}
