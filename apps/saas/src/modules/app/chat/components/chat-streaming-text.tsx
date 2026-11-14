"use client";

import { readTextStream } from "@app/chat/lib/read-text-stream";
import { createLogger } from "@fuutu/logs";
import { useEffect, useRef, useState } from "react";

const log = createLogger({ scope: "chat-stream" });

type ChatStreamingTextProps = {
	stream: ReadableStream<Uint8Array> | null;
	/** The reply text — with the error when the stream failed mid-way. */
	onComplete: (fullText: string, error?: unknown) => void;
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
		// StrictMode-safe reader (dev re-runs this effect once).
		return readTextStream(stream, {
			onText: setText,
			onDone: (full, error) => {
				if (error) log.error("stream pump failed", { err: error });
				if (!completedRef.current) {
					completedRef.current = true;
					onComplete(full, error);
				}
			},
		});
	}, [stream, onComplete]);

	return (
		<div className="wrap-break-word whitespace-pre-wrap text-sm">
			{text}
			<span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle" />
		</div>
	);
}
