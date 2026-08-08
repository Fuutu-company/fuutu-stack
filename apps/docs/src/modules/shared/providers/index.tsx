"use client";

import type { PropsWithChildren } from "react";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: PropsWithChildren) {
	return <ThemeProvider>{children}</ThemeProvider>;
}
