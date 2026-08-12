"use client";

import { BrandLogo, Button } from "@fuutu/ui";
import { LocaleSwitcher } from "@shared/components";
import type { LucideIcon } from "lucide-react";
import {
	BookOpen,
	ChevronDown,
	Menu,
	Moon,
	Rss,
	Sun,
	Terminal,
	X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import type { ComponentType } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { defaultLocale } from "@/i18n/config";
import { urls } from "@/lib/urls";
import { handleHashClick } from "@/lib/utils";
import { Link, usePathname, useRouter } from "@/navigation";

type IconType = LucideIcon | ComponentType<{ className?: string }>;

type DropdownItem = {
	key: string;
	href: string;
	external?: boolean;
	hash?: boolean;
	icon: IconType;
};

type NavItem = {
	key: string;
	href: string;
	external?: boolean;
	hash?: boolean;
	badgeKey?: string;
};

const DROPDOWN_GROUPS: Record<string, DropdownItem[]> = {
	resources: [
		{ key: "blog", href: "/blog", icon: Rss },
		{ key: "changelog", href: "/changelog", icon: Terminal },
		{ key: "docs", href: urls.docs, external: true, icon: BookOpen },
	],
};

const DROPDOWN_ORDER = ["resources"] as const;

const NAV_ITEMS: NavItem[] = [
	{ key: "home", href: "/" },
	{ key: "features", href: "/#features", hash: true },
	{ key: "pricing", href: "/pricing" },
];

function isActive(pathname: string, href: string, hash?: string): boolean {
	if (href === "/") return pathname === "/" && !hash;
	if (href.includes("#")) {
		const [page, section] = href.split("#");
		return pathname === page && hash === `#${section}`;
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

function isDropdownActive(
	pathname: string,
	items: DropdownItem[],
	hash?: string,
): boolean {
	return items.some((item) => {
		if (item.external || item.hash) return false;
		return isActive(pathname, item.href, hash);
	});
}

interface MegaMenuProps {
	groupKey: string;
	items: DropdownItem[];
	isOpen: boolean;
	onEnter: () => void;
	onLeave: () => void;
	onTriggerClick: () => void;
	locale: string;
	pathname: string;
	router: ReturnType<typeof useRouter>;
	triggerRef: (el: HTMLElement | null) => void;
}

function MegaMenu({
	groupKey,
	items,
	isOpen,
	onEnter,
	onLeave,
	onTriggerClick,
	locale,
	pathname,
	router,
	triggerRef,
}: MegaMenuProps) {
	const t = useTranslations();

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover menu requires mouse events on container
		<div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
			<button
				ref={triggerRef}
				type="button"
				onClick={onTriggerClick}
				className={`relative flex items-center gap-1 px-3 py-1.5 font-medium text-sm transition-colors ${
					isOpen
						? "text-foreground"
						: isDropdownActive(pathname, items)
							? "text-foreground"
							: "text-muted-foreground hover:text-foreground"
				}`}
			>
				{t(`nav.${groupKey}`)}
				<ChevronDown
					className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && (
				<div className="absolute top-full left-0 z-50 pt-2">
					<div className="overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-xl">
						<div className="grid min-w-70 gap-1 p-2">
							{items.map((item) => {
								const Icon = item.icon;
								const content = (
									<>
										<div className="flex size-5 shrink-0 items-center justify-center text-primary">
											<Icon className="size-4" />
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-medium text-foreground text-sm">
												{t(`nav.${item.key}`)}
											</p>
											<p className="truncate text-muted-foreground text-xs">
												{t(`nav.descriptions.${item.key}`)}
											</p>
										</div>
									</>
								);

								const className =
									"flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent";

								if (item.external) {
									return (
										<a
											key={item.key}
											href={item.href}
											target="_blank"
											rel="noopener noreferrer"
											className={className}
										>
											{content}
										</a>
									);
								}
								if (item.hash) {
									return (
										<a
											key={item.key}
											href={
												locale === defaultLocale
													? item.href
													: `/${locale}${item.href}`
											}
											className={className}
											onClick={(e) =>
												handleHashClick(e, item.href, pathname, router)
											}
										>
											{content}
										</a>
									);
								}
								return (
									<Link key={item.key} href={item.href} className={className}>
										{content}
									</Link>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

const NavLinks = memo(function NavLinks() {
	const t = useTranslations();
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const [hash, setHash] = useState<string>("");
	const linkRefs = useRef<(HTMLElement | null)[]>([]);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const navRef = useRef<HTMLDivElement>(null);
	const [underline, setUnderline] = useState({
		left: 0,
		width: 0,
		show: false,
	});

	useEffect(() => {
		setHash(window.location.hash);
		const handler = () => setHash(window.location.hash);
		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);
	}, []);

	const handleEnter = useCallback((key: string) => {
		if (closeTimer.current) {
			clearTimeout(closeTimer.current);
			closeTimer.current = null;
		}
		setOpenDropdown(key);
	}, []);

	const handleLeave = useCallback(() => {
		closeTimer.current = setTimeout(() => {
			setOpenDropdown(null);
		}, 150);
	}, []);

	useEffect(() => {
		if (!openDropdown) return;
		const handler = (e: MouseEvent) => {
			if (navRef.current && !navRef.current.contains(e.target as Node)) {
				setOpenDropdown(null);
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [openDropdown]);

	const ALL_SLOTS = [
		...NAV_ITEMS.map((item) => ({
			key: item.key,
			isActive: (p: string) => isActive(p, item.href, hash),
		})),
		...DROPDOWN_ORDER.map((key) => ({
			key,
			isActive: (p: string) => isDropdownActive(p, DROPDOWN_GROUPS[key], hash),
		})),
	];

	useEffect(() => {
		const idx = ALL_SLOTS.findIndex((slot) => slot.isActive(pathname));
		if (idx >= 0 && linkRefs.current[idx] && navRef.current) {
			const el = linkRefs.current[idx];
			const navRect = navRef.current.getBoundingClientRect();
			const elRect = el.getBoundingClientRect();
			setUnderline({
				left: elRect.left - navRect.left,
				width: elRect.width,
				show: true,
			});
		} else {
			setUnderline((prev) => ({ ...prev, show: false }));
		}
	}, [pathname, hash]);

	const navLinkClass = (href: string) => {
		const active = isActive(pathname, href, hash);
		return [
			"relative px-3 py-1.5 font-medium text-sm transition-colors",
			active
				? "text-foreground"
				: "text-muted-foreground hover:text-foreground",
		].join(" ");
	};

	return (
		<div ref={navRef} className="relative hidden items-center gap-1 md:flex">
			{NAV_ITEMS.map((item, i) => {
				const slotIdx = i;
				const content = (
					<>
						{t(`nav.${item.key}`)}
						{item.badgeKey && (
							<span className="absolute -top-0.5 -right-0.5 rounded-full bg-primary px-1 py-px font-medium text-[8px] text-primary-foreground leading-tight">
								{t(`nav.badges.${item.badgeKey}`)}
							</span>
						)}
					</>
				);
				const setRef = (el: HTMLElement | null) => {
					linkRefs.current[slotIdx] = el;
				};
				if (item.external) {
					return (
						<a
							key={item.key}
							ref={setRef}
							href={item.href}
							target="_blank"
							rel="noopener noreferrer"
							className={navLinkClass(item.href)}
						>
							{content}
						</a>
					);
				}
				if (item.hash) {
					return (
						<a
							key={item.key}
							ref={setRef}
							href={
								locale === defaultLocale ? item.href : `/${locale}${item.href}`
							}
							className={navLinkClass(item.href)}
							onClick={(e) => handleHashClick(e, item.href, pathname, router)}
						>
							{content}
						</a>
					);
				}
				return (
					<Link
						key={item.key}
						ref={setRef}
						href={item.href}
						className={navLinkClass(item.href)}
						onClick={() => {
							if (window.location.hash) {
								history.pushState(null, "", window.location.pathname);
								window.dispatchEvent(new HashChangeEvent("hashchange"));
							}
						}}
					>
						{content}
					</Link>
				);
			})}

			{DROPDOWN_ORDER.map((groupKey, dropdownIdx) => (
				<MegaMenu
					key={groupKey}
					groupKey={groupKey}
					items={DROPDOWN_GROUPS[groupKey]}
					isOpen={openDropdown === groupKey}
					onEnter={() => handleEnter(groupKey)}
					onLeave={handleLeave}
					onTriggerClick={() => setOpenDropdown(groupKey)}
					locale={locale}
					pathname={pathname}
					router={router}
					triggerRef={(el) => {
						linkRefs.current[NAV_ITEMS.length + dropdownIdx] = el;
					}}
				/>
			))}

			<div
				className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary transition-all duration-300 ease-out"
				style={{
					transform: `translateX(${underline.left}px)`,
					width: underline.width,
					opacity: underline.show ? 1 : 0,
				}}
			/>
		</div>
	);
});

export function MarketingNavbar() {
	const t = useTranslations();
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		const handler = () => setScrolled(window.scrollY > 10);
		window.addEventListener("scroll", handler, { passive: true });
		return () => window.removeEventListener("scroll", handler);
	}, []);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, []);

	useEffect(() => {
		document.body.style.overflow = open ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intentional trigger
	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	const mobileNavLinkClass = (href: string) => {
		const active = isActive(pathname, href);
		return [
			"relative rounded-lg px-3 py-2.5 text-sm transition-colors",
			active
				? "bg-accent font-medium text-foreground"
				: "text-muted-foreground hover:bg-accent hover:text-foreground",
		].join(" ");
	};

	return (
		<header
			className={[
				"fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-out",
				scrolled
					? "border-border border-b bg-background/80 shadow-sm backdrop-blur-md"
					: "border-transparent border-b bg-transparent",
			].join(" ")}
		>
			<nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
				{/* Left — logo + nav links */}
				<div className="flex items-center gap-6">
					<Link href="/" className="flex shrink-0 items-center gap-2.5">
						<BrandLogo
							size="xl"
							alt={t("app.brand")}
							className="size-9 dark:invert"
						/>
						<span className="font-semibold text-foreground text-sm tracking-tight">
							{t("app.brand")}
						</span>
					</Link>

					<NavLinks />
				</div>

				{/* Right — actions */}
				<div className="hidden items-center gap-1.5 md:flex">
					<LocaleSwitcher />
					{mounted && (
						<Button
							size="icon"
							variant="ghost"
							onClick={() =>
								setTheme(resolvedTheme === "dark" ? "light" : "dark")
							}
							aria-label={t("nav.toggleTheme")}
						>
							{resolvedTheme === "dark" ? (
								<Sun className="size-4" />
							) : (
								<Moon className="size-4" />
							)}
						</Button>
					)}
					<Button variant="ghost" size="sm" asChild>
						<a href={urls.auth.signIn}>{t("nav.signIn")}</a>
					</Button>
					<Button size="sm" className="rounded-full shadow-sm" asChild>
						<a href={urls.auth.signUp}>{t("nav.getStarted")}</a>
					</Button>
				</div>

				{/* Burger — mobile */}
				<Button
					size="icon"
					variant="ghost"
					className="md:hidden"
					onClick={() => setOpen((v) => !v)}
					aria-label={t("nav.toggleMenu")}
					aria-expanded={open}
				>
					{open ? <X className="size-4" /> : <Menu className="size-4" />}
				</Button>
			</nav>

			{/* Mobile menu */}
			<div
				className={[
					"overflow-hidden border-border/60 border-b transition-all duration-300 ease-out md:hidden",
					open ? "max-h-100 opacity-100" : "max-h-0 opacity-0",
				].join(" ")}
			>
				<div className="mx-auto max-w-6xl px-4 pt-3 pb-5 sm:px-6">
					<div className="flex flex-col gap-1">
						{NAV_ITEMS.map((item) =>
							item.external ? (
								<a
									key={item.key}
									href={item.href}
									target="_blank"
									rel="noopener noreferrer"
									className={mobileNavLinkClass(item.href)}
								>
									{t(`nav.${item.key}`)}
									{item.badgeKey && (
										<span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
											{t(`nav.badges.${item.badgeKey}`)}
										</span>
									)}
								</a>
							) : item.hash ? (
								<a
									key={item.key}
									href={
										locale === defaultLocale
											? item.href
											: `/${locale}${item.href}`
									}
									className={mobileNavLinkClass(item.href)}
									onClick={(e) => {
										handleHashClick(e, item.href, pathname, router);
										setOpen(false);
									}}
								>
									{t(`nav.${item.key}`)}
									{item.badgeKey && (
										<span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
											{t(`nav.badges.${item.badgeKey}`)}
										</span>
									)}
								</a>
							) : (
								<Link
									key={item.key}
									href={item.href}
									className={mobileNavLinkClass(item.href)}
								>
									{t(`nav.${item.key}`)}
									{item.badgeKey && (
										<span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary">
											{t(`nav.badges.${item.badgeKey}`)}
										</span>
									)}
								</Link>
							),
						)}

						{DROPDOWN_ORDER.map((groupKey) => (
							<div key={groupKey} className="rounded-lg bg-muted/50 p-3">
								<p className="mb-2 font-semibold text-foreground text-sm">
									{t(`nav.${groupKey}`)}
								</p>
								{DROPDOWN_GROUPS[groupKey].map((item) => {
									const Icon = item.icon;
									const content = (
										<span className="flex items-center gap-2.5">
											<Icon className="size-4 text-primary" />
											{t(`nav.${item.key}`)}
										</span>
									);
									if (item.external) {
										return (
											<a
												key={item.key}
												href={item.href}
												target="_blank"
												rel="noopener noreferrer"
												className="block rounded-md px-3 py-2 text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
											>
												{content}
											</a>
										);
									}
									if (item.hash) {
										return (
											<a
												key={item.key}
												href={
													locale === defaultLocale
														? item.href
														: `/${locale}${item.href}`
												}
												className="block rounded-md px-3 py-2 text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
												onClick={(e) =>
													handleHashClick(e, item.href, pathname, router)
												}
											>
												{content}
											</a>
										);
									}
									return (
										<Link
											key={item.key}
											href={item.href}
											className="block rounded-md px-3 py-2 text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
										>
											{content}
										</Link>
									);
								})}
							</div>
						))}
					</div>
					<div className="mt-4 flex items-center gap-2">
						<LocaleSwitcher />
						{mounted && (
							<Button
								size="icon"
								variant="ghost"
								onClick={() =>
									setTheme(resolvedTheme === "dark" ? "light" : "dark")
								}
								aria-label={t("nav.toggleTheme")}
							>
								{resolvedTheme === "dark" ? (
									<Sun className="size-4" />
								) : (
									<Moon className="size-4" />
								)}
							</Button>
						)}
					</div>
					<div className="mt-4 flex flex-col gap-2">
						<Button variant="ghost" size="sm" asChild className="w-full">
							<a href={urls.auth.signIn}>{t("nav.signIn")}</a>
						</Button>
						<Button className="w-full" asChild>
							<a href={urls.auth.signUp}>{t("nav.getStarted")}</a>
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}
