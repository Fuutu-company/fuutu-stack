import { Controls } from "./controls";
import { Display } from "./display";
import { Fields } from "./fields";
import { Overlays } from "./overlays";
import { SidebarDemo } from "./sidebar-demo";

export function ComponentMatrix() {
	return (
		<div className="space-y-14">
			<Controls />
			<Fields />
			<Overlays />
			<Display />
			<SidebarDemo />
		</div>
	);
}
