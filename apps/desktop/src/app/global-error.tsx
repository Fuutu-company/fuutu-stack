"use client";

import "./globals.css";
import { useEffect } from "react";
import { logError } from "@/lib/desktop";

/**
 * Last-resort boundary (the root layout itself failed): no providers, so no
 * translations — a plain, language-neutral retry.
 */
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		void logError("fatal render error", error);
	}, [error]);
	return (
		<html lang="en">
			<body className="bg-background p-8 text-foreground">
				<button
					type="button"
					onClick={reset}
					className="rounded-md border px-4 py-2"
				>
					↻
				</button>
			</body>
		</html>
	);
}
