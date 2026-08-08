"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

export function QueryProvider({ children }: PropsWithChildren) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000,
					},
				},
			}),
	);

	// Hide DevTools in E2E tests to prevent pointer event interception.
	// Deferred to useEffect to avoid hydration mismatch — server renders
	// false, client initially renders false, then updates after mount.
	const [showDevTools, setShowDevTools] = useState(false);

	useEffect(() => {
		setShowDevTools(
			!(window as unknown as { __PLAYWRIGHT_TEST__?: boolean })
				.__PLAYWRIGHT_TEST__,
		);
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{showDevTools && <ReactQueryDevtools initialIsOpen={false} />}
		</QueryClientProvider>
	);
}
