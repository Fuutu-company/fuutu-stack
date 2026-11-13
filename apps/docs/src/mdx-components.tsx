import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Card } from "fumadocs-ui/components/card";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { icons } from "lucide-react";
import type { MDXComponents } from "mdx/types";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { appDocs } from "./app-docs";

/** `icon="book-open"` in MDX → the Lucide icon `BookOpen`. */
function resolveIcon(icon: ReactNode): ReactNode {
	if (typeof icon !== "string") return icon;
	const name = icon.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) =>
		c.toUpperCase(),
	) as keyof typeof icons;
	const Icon = icons[name];
	return Icon ? createElement(Icon) : null;
}

function MdxCard({ icon, ...props }: ComponentProps<typeof Card>) {
	return <Card icon={resolveIcon(icon)} {...props} />;
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
	return {
		...defaultMdxComponents,
		Card: MdxCard,
		Accordion,
		Accordions,
		File,
		Files,
		Folder,
		Step,
		Steps,
		Tab,
		Tabs,
		TypeTable,
		...appDocs.mdxComponents,
		...components,
	};
}
