"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { type PropsWithChildren, useState } from "react";
import { DesktopIntlProvider } from "./intl-provider";

export function Providers({ children }: PropsWithChildren) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
			}),
	);
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<QueryClientProvider client={queryClient}>
				<DesktopIntlProvider>{children}</DesktopIntlProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
}
