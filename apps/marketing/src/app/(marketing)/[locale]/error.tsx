"use client";

import { ErrorBoundary } from "@shared/components";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	return <ErrorBoundary error={error} reset={reset} />;
}
