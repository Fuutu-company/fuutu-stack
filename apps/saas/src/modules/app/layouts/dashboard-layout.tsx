import { SidebarInset, SidebarProvider } from "@fuutu/ui";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppHeader } from "../components/app-header";
import { MobileHeader } from "../components/mobile-header";
import { AppSidebar } from "../components/sidebar";

export interface DashboardLayoutProps {
	children: ReactNode;
}

export async function DashboardLayout({ children }: DashboardLayoutProps) {
	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get("sidebar_state");
	const defaultOpen = sidebarCookie?.value !== "false";

	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<AppSidebar />
			<SidebarInset>
				<MobileHeader />
				<AppHeader />
				<div className="flex-1 overflow-y-auto p-6">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
