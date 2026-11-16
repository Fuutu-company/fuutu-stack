import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 300;

/**
 * Commits the trimmed `draft` (e.g. a search box) after the user stops
 * typing, unless it already equals the `committed` value (the URL).
 * `onCommit` may change every render — only the latest one is called.
 */
export function useDebouncedCommit(
	draft: string,
	committed: string,
	onCommit: (value: string) => void,
	enabled = true,
): void {
	const onCommitRef = useRef(onCommit);
	useEffect(() => {
		onCommitRef.current = onCommit;
	});

	useEffect(() => {
		if (!enabled || draft.trim() === committed) return;
		const timer = setTimeout(
			() => onCommitRef.current(draft.trim()),
			DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [draft, committed, enabled]);
}
