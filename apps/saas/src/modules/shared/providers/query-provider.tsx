"use client";

import { createLogger } from "@fuutu/logs";
import {
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const log = createLogger({ scope: "query" });

export function QueryProvider({ children }: PropsWithChildren) {
	const t = useTranslations("common.errors");
	const [queryClient] = useState(
		() =>
			new QueryClient({
				queryCache: new QueryCache({
					onError: (error, query) => {
						log.error("query failed", {
							err: error,
							queryKey: query.queryKey,
						});
						toast.error(t("somethingWentWrong"), {
							action: {
								label: t("retry"),
								onClick: query.invalidate,
							},
						});
					},
				}),
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
