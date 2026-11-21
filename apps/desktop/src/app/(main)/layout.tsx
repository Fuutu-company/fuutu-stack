import type { PropsWithChildren } from "react";
import { AccessGate } from "@/components/access-gate";
import { AccountProvider } from "@/components/account-provider";
import { AppShell } from "@/components/app-shell";
import { UpdateDialog } from "@/components/update-dialog";

export default function MainLayout({ children }: PropsWithChildren) {
	return (
		<AccountProvider>
			<AccessGate>
				<AppShell>{children}</AppShell>
				<UpdateDialog />
			</AccessGate>
		</AccountProvider>
	);
}
