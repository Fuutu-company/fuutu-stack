import type { Folder, Node, Root } from "fumadocs-core/page-tree";
import type { ReactNode } from "react";

/** One docs page as the docs home lists it. */
export interface DocsSectionPage {
	name: string;
	url: string;
	description?: string;
}

/** One sidebar section (a separator group or a top-level folder) with its pages. */
export interface DocsSection {
	key: string;
	name: string;
	icon?: ReactNode;
	/** URL of the section's first page. */
	href: string;
	pageCount: number;
	pages: DocsSectionPage[];
}

const text = (value: ReactNode): string | undefined =>
	typeof value === "string" || typeof value === "number"
		? String(value)
		: undefined;

/** Internal docs pages under `nodes`, in sidebar order (folder index first). */
function collectPages(nodes: readonly Node[]): DocsSectionPage[] {
	const pages: DocsSectionPage[] = [];
	for (const node of nodes) {
		if (node.type === "separator") continue;
		const items = node.type === "page" ? [node] : [];
		if (node.type === "folder" && node.index) items.push(node.index);
		for (const item of items) {
			if (item.external) continue;
			pages.push({
				name: text(item.name) ?? item.url,
				url: item.url,
				description: text(item.description),
			});
		}
		if (node.type === "folder") pages.push(...collectPages(node.children));
	}
	return pages;
}

interface Group {
	key: string;
	name: string;
	icon?: ReactNode;
	nodes: Node[];
}

/** Separator groups when the sidebar has separators, else one group per top-level folder. */
function groupNodes(nodes: readonly Node[]): Group[] {
	if (nodes.some((node) => node.type === "separator")) {
		const groups: Group[] = [];
		for (const node of nodes) {
			if (node.type === "separator") {
				const name = text(node.name) ?? "";
				groups.push({
					key: node.$id ?? name,
					name,
					icon: node.icon,
					nodes: [],
				});
			} else {
				groups.at(-1)?.nodes.push(node);
			}
		}
		return groups.filter((group) => group.name);
	}
	return nodes
		.filter((node): node is Folder => node.type === "folder")
		.map((node) => {
			const name = text(node.name) ?? "";
			return {
				key: node.$id ?? name,
				name,
				icon: node.icon,
				nodes: node.index ? [node.index, ...node.children] : node.children,
			};
		})
		.filter((group) => group.name);
}

/**
 * The sidebar's sections with their pages, read from the page tree so the
 * docs home never drifts from the sidebar. A single root folder is opened
 * while it holds folders or separators (a folder of pages is a section).
 */
export function docsSections(tree: Root): DocsSection[] {
	let nodes: readonly Node[] = tree.children;
	while (nodes.length === 1 && nodes[0]?.type === "folder") {
		const inner = nodes[0].children;
		if (inner.every((node) => node.type === "page")) break;
		nodes = inner;
	}
	return groupNodes(nodes).flatMap((group) => {
		const pages = collectPages(group.nodes);
		const first = pages[0];
		if (!first) return [];
		return [
			{
				key: group.key,
				name: group.name,
				icon: group.icon,
				href: first.url,
				pageCount: pages.length,
				pages,
			},
		];
	});
}
