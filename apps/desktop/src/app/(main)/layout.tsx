import type { PropsWithChildren } from "react";
import { AppShell } from "@/components/app-shell";

export default function MainLayout({ children }: PropsWithChildren) {
	return <AppShell>{children}</AppShell>;
}
