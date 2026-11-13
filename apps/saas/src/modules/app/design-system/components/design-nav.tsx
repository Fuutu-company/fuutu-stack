"use client";

import { cn } from "@fuutu/utils/cn";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import type { DesignSectionId } from "../sections";

interface DesignNavProps {
	label: string;
	items: { id: DesignSectionId; title: string }[];
}

/**
 * Sticky pill nav for the long `/design` page. The active section is the
 * last one whose top has passed its own scroll margin (the line a jump
 * lands on), so a click and the indicator always agree.
 */
export function DesignNav({ label, items }: DesignNavProps) {
	const [active, setActive] = useState<DesignSectionId | null>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		let frame = 0;
		const update = () => {
			frame = 0;
			let current: DesignSectionId | null = null;
			for (const { id } of items) {
				const section = document.getElementById(id);
				if (!section) continue;
				const margin = Number.parseFloat(
					getComputedStyle(section).scrollMarginTop,
				);
				if (section.getBoundingClientRect().top <= margin + 8) current = id;
			}
			const atBottom =
				window.innerHeight + window.scrollY >=
				document.documentElement.scrollHeight - 2;
			if (atBottom && current) current = items.at(-1)?.id ?? current;
			setActive(current);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [items]);

	// Keep the active pill visible in the horizontally scrolling row (phones).
	useEffect(() => {
		const list = listRef.current;
		const link = active
			? list?.querySelector<HTMLElement>(`a[href='#${active}']`)
			: null;
		if (!list || !link) return;
		const left = link.offsetLeft - list.offsetLeft;
		if (
			left < list.scrollLeft ||
			left + link.offsetWidth > list.scrollLeft + list.clientWidth
		) {
			list.scrollTo({ left: left - 8 });
		}
	}, [active]);

	const jump = (event: MouseEvent<HTMLAnchorElement>, id: DesignSectionId) => {
		const section = document.getElementById(id);
		if (!section) return;
		event.preventDefault();
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		section.scrollIntoView({
			behavior: reduced ? "auto" : "smooth",
			block: "start",
		});
		section.focus({ preventScroll: true });
		history.replaceState(null, "", `#${id}`);
		setActive(id);
	};

	return (
		<nav
			aria-label={label}
			className="sticky top-[4.25rem] z-30 mx-auto flex w-fit max-w-full md:top-3"
		>
			<ul
				ref={listRef}
				className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-card/90 p-1 text-card-foreground shadow-md ring-1 ring-foreground/5 backdrop-blur-md [scrollbar-width:none] dark:ring-foreground/10 [&::-webkit-scrollbar]:hidden"
			>
				{items.map(({ id, title }) => (
					<li key={id} className="shrink-0">
						<a
							href={`#${id}`}
							aria-current={active === id ? "location" : undefined}
							onClick={(event) => jump(event, id)}
							className={cn(
								"inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 font-semibold text-muted-foreground text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
								"aria-[current=location]:bg-primary aria-[current=location]:text-primary-foreground aria-[current=location]:hover:bg-primary aria-[current=location]:hover:text-primary-foreground",
							)}
						>
							{title}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
