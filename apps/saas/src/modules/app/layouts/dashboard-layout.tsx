import { SidebarInset, SidebarProvider } from "@fuutu/ui";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { appSlots } from "@/app-slots";
import { AppHeader } from "../components/app-header";
import { ErrorToast } from "../components/error-toast";
import { ImpersonationBanner } from "../components/impersonation-banner";
import { MobileHeader } from "../components/mobile-header";
import { AppSidebar } from "../components/sidebar";
import { renderSlot } from "../slots";

export interface DashboardLayoutProps {
	children: ReactNode;
}

export async function DashboardLayout({ children }: DashboardLayoutProps) {
	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get("sidebar_state");
	const defaultOpen = sidebarCookie?.value !== "false";
	const t = await getTranslations("navigation");
	// Rendered here (server) so a server component works in the client header;
	// unset, AppHeader gets no prop at all — its RSC props stay as before.
	const headerActions = renderSlot(appSlots.headerActions, {});

	return (
		<SidebarProvider
			defaultOpen={defaultOpen}
			labels={{
				mobileTitle: t("sidebar.title"),
				mobileDescription: t("sidebar.description"),
				toggle: t("aria.toggleNavigation"),
			}}
		>
			<AppSidebar />
			<Suspense>
				<ErrorToast />
			</Suspense>
			<SidebarInset className="min-w-0">
				<ImpersonationBanner />
				<MobileHeader />
				{headerActions ? <AppHeader actions={headerActions} /> : <AppHeader />}
				{/* The document scrolls, not this column: `overflow-x-clip` contains wide content without becoming a scroll container, so `position: sticky` inside pages works. */}
				<div className="min-w-0 flex-1 overflow-x-clip bg-background px-4 pt-4 pb-10 md:px-8 md:pt-0">
					<div className="mx-auto w-full max-w-7xl">{children}</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
