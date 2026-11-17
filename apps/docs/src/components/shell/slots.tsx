import {
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
} from "fumadocs-ui/components/sidebar/base";
import type { DocsSlots } from "fumadocs-ui/layouts/docs";
import { DocsSidebar } from "./docs-sidebar";

export { DocsContainer } from "./docs-container";
export { DocsHeader } from "./docs-header";

/**
 * The kit's `slots.sidebar`: the floating sidebar card around the fumadocs
 * provider, trigger and state. Apps replace it through
 * `appDocs.layoutSlots.sidebar`.
 */
export const docsSidebarSlot: DocsSlots["sidebar"] = {
	provider: SidebarProvider,
	root: DocsSidebar,
	trigger: SidebarTrigger,
	useSidebar,
};
