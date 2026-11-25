"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Search } from "lucide-react";

/** The hero search: a large field-shaped button that opens the docs search. */
export function DocsHomeSearch({ label }: { label: string }) {
	const { enabled, hotKey, setOpenSearch } = useSearchContext();
	if (!enabled) return null;
	return (
		<button
			type="button"
			onClick={() => setOpenSearch(true)}
			className="flex h-12 w-full max-w-xl items-center gap-3 rounded-full border border-input bg-card px-5 text-left text-muted-foreground text-sm shadow-xs outline-none transition-colors hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Search aria-hidden="true" className="size-4 shrink-0" />
			<span className="flex-1">{label}</span>
			<span aria-hidden="true" className="hidden gap-0.5 sm:inline-flex">
				{hotKey.map((key) => (
					<kbd
						key={String(key.display)}
						className="rounded-md border px-1.5 font-mono text-xs"
					>
						{key.display}
					</kbd>
				))}
			</span>
		</button>
	);
}
