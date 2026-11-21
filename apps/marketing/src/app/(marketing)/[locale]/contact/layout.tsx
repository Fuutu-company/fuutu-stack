import { notFound } from "next/navigation";
import type { PropsWithChildren } from "react";
import { isKitRouteEnabled } from "@/lib/kit-routes";

/** Answers 404 while the app switched this page off (`appKitRoutes` in `app-site-links.ts`). */
export default function Layout({ children }: PropsWithChildren) {
	if (!isKitRouteEnabled("contact")) notFound();
	return children;
}
