"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../button";
import { copyToClipboard } from "./copy-to-clipboard";

export type SecretFieldLabels = {
	copy: string;
	copied: string;
	/** Shown when the clipboard write fails; the secret is selected instead. */
	copyFailed: string;
};

const COPIED_RESET_MS = 2000;

function selectContents(el: HTMLElement | null) {
	const selection = el ? window.getSelection() : null;
	if (!el || !selection) return;
	const range = document.createRange();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}

/**
 * The full secret, wrapped (never truncated) and selectable, with a copy
 * button. Stacks below `sm`.
 */
export function SecretField({
	secret,
	labels,
}: {
	secret: string;
	labels: SecretFieldLabels;
}) {
	const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
	const codeRef = useRef<HTMLElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	async function copy() {
		const copied = await copyToClipboard(secret);
		if (timer.current) clearTimeout(timer.current);
		if (copied) {
			setState("copied");
			timer.current = setTimeout(() => setState("idle"), COPIED_RESET_MS);
			return;
		}
		setState("failed");
		selectContents(codeRef.current);
	}

	return (
		<div className="min-w-0 space-y-2">
			<div className="flex flex-col gap-2 rounded-md border bg-muted p-3 sm:flex-row sm:items-center">
				<code
					ref={codeRef}
					className="min-w-0 flex-1 select-all break-all font-mono text-sm"
				>
					{secret}
				</code>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="shrink-0"
					onClick={copy}
				>
					{state === "copied" ? (
						<Check className="size-4" />
					) : (
						<Copy className="size-4" />
					)}
					{state === "copied" ? labels.copied : labels.copy}
				</Button>
			</div>
			{state === "failed" && (
				<p role="alert" className="text-destructive text-xs">
					{labels.copyFailed}
				</p>
			)}
		</div>
	);
}
