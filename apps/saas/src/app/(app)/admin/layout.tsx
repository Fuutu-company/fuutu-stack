import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth-server";

export default async function AdminLayout({
	children,
}: {
	children: ReactNode;
}) {
	await requireAdmin();
	return <div className="mx-auto max-w-6xl space-y-6">{children}</div>;
}
