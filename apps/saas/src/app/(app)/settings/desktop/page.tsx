import { config } from "@fuutu/config";
import { notFound } from "next/navigation";
import { DesktopAppSettings } from "@/modules/app/desktop/desktop-app-settings";

/** Account settings → Desktop app (`config.features.desktop`). */
export default function DesktopAppPage() {
	if (!config.features.desktop) notFound();
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<DesktopAppSettings />
		</div>
	);
}
