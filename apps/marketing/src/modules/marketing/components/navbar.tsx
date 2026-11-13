"use client";

import { config } from "@fuutu/config";
import { AreaBadge, BrandLogo, Button } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { LocaleSwitcher } from "@shared/components";
import { ArrowRight, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
	type MouseEvent,
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { defaultLocale } from "@/i18n/config";
import {
	NAV_DROPDOWNS,
	NAV_ITEMS,
	type NavDropdownItem,
	type NavItem,
} from "@/lib/site-links";
import { urls } from "@/lib/urls";
import { handleHashClick } from "@/lib/utils";
import { Link, usePathname, useRouter } from "@/navigation";

// Navbar links live in `@/lib/site-links` — edit them there.
const DROPDOWN_GROUPS: Record<string, NavDropdownItem[]> = Object.fromEntries(
	NAV_DROPDOWNS.map((group) => [group.key, group.items]),
);

const DROPDOWN_ORDER = NAV_DROPDOWNS.map((group) => group.key);

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
	items: NavDropdownItem[],
	hash?: string,
): boolean {
	return items.some((item) => {
		if (item.external || item.hash) return false;
		return isActive(pathname, item.href, hash);
	});
}

/** Renders a site link as an external anchor, a same-page hash anchor or a locale-aware Link. */
function SiteLink({
	item,
	className,
	children,
	onNavigate,
}: {
	item: Pick<NavItem, "key" | "href" | "external" | "hash">;
	className: string;
	children: ReactNode;
	onNavigate?: () => void;
}) {
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();

	if (item.external) {
		return (
			<a
				href={item.href}
				target="_blank"
				rel="noopener noreferrer"
				className={className}
			>
				{children}
			</a>
		);
	}
	if (item.hash) {
		return (
			<a
				href={locale === defaultLocale ? item.href : `/${locale}${item.href}`}
				className={className}
				onClick={(e: MouseEvent) => {
					handleHashClick(e, item.href, pathname, router);
					onNavigate?.();
				}}
			>
				{children}
			</a>
		);
	}
	return (
		<Link
			href={item.href}
			className={className}
			onClick={() => {
				if (window.location.hash) {
					history.pushState(null, "", window.location.pathname);
					window.dispatchEvent(new HashChangeEvent("hashchange"));
				}
				onNavigate?.();
			}}
		>
			{children}
		</Link>
	);
}

const PILL_ITEM =
	"relative inline-flex items-center gap-1 rounded-full px-3.5 py-2 font-semibold text-sm transition-colors duration-150 motion-reduce:transition-none";
const PILL_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const PILL_ACTIVE = "bg-muted text-foreground";

interface MegaMenuProps {
	groupKey: string;
	items: NavDropdownItem[];
	isOpen: boolean;
	active: boolean;
	onEnter: () => void;
	onLeave: () => void;
	onTriggerClick: () => void;
}

function MegaMenu({
	groupKey,
	items,
	isOpen,
	active,
	onEnter,
	onLeave,
	onTriggerClick,
}: MegaMenuProps) {
	const t = useTranslations();

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover menu requires mouse events on container
		<div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
			<button
				type="button"
				onClick={onTriggerClick}
				aria-expanded={isOpen}
				className={cn(PILL_ITEM, isOpen || active ? PILL_ACTIVE : PILL_IDLE)}
			>
				{t(`nav.${groupKey}`)}
				<ChevronDown
					className={cn(
						"size-3.5 transition-transform duration-200 motion-reduce:transition-none",
						isOpen && "rotate-180",
					)}
				/>
			</button>

			{isOpen && (
				<div className="absolute top-full left-1/2 z-50 -translate-x-1/2 pt-3">
					<div className="grid min-w-72 gap-1 rounded-2xl bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">
						{items.map((item) => {
							const Icon = item.icon;
							return (
								<SiteLink
									key={item.key}
									item={item}
									className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent"
								>
									<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
										<Icon className="size-4" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block font-semibold text-foreground text-sm">
											{t(`nav.${item.key}`)}
										</span>
										<span className="block truncate text-muted-foreground text-xs">
											{t(`nav.descriptions.${item.key}`)}
										</span>
									</span>
								</SiteLink>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

function NewBadge({ badgeKey }: { badgeKey: string }) {
	const t = useTranslations();
	return (
		<AreaBadge area="ai" className="h-5 px-2 text-[11px]">
			{t(`nav.badges.${badgeKey}`)}
		</AreaBadge>
	);
}

const NavLinks = memo(function NavLinks() {
	const t = useTranslations();
	const pathname = usePathname();
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const [hash, setHash] = useState<string>("");
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const navRef = useRef<HTMLDivElement>(null);

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
		const onClick = (e: globalThis.MouseEvent) => {
			if (navRef.current && !navRef.current.contains(e.target as Node)) {
				setOpenDropdown(null);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpenDropdown(null);
		};
		document.addEventListener("click", onClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("click", onClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [openDropdown]);

	return (
		<div ref={navRef} className="hidden items-center gap-1 lg:flex">
			{NAV_ITEMS.map((item) => (
				<SiteLink
					key={item.key}
					item={item}
					className={cn(
						PILL_ITEM,
						isActive(pathname, item.href, hash) ? PILL_ACTIVE : PILL_IDLE,
					)}
				>
					{t(`nav.${item.key}`)}
					{item.badgeKey && <NewBadge badgeKey={item.badgeKey} />}
				</SiteLink>
			))}

			{DROPDOWN_ORDER.map((groupKey) => (
				<MegaMenu
					key={groupKey}
					groupKey={groupKey}
					items={DROPDOWN_GROUPS[groupKey]}
					isOpen={openDropdown === groupKey}
					active={isDropdownActive(pathname, DROPDOWN_GROUPS[groupKey], hash)}
					onEnter={() => handleEnter(groupKey)}
					onLeave={handleLeave}
					onTriggerClick={() =>
						setOpenDropdown((current) =>
							current === groupKey ? null : groupKey,
						)
					}
				/>
			))}
		</div>
	);
});

function ThemeToggle() {
	const t = useTranslations();
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	if (!mounted) return <span aria-hidden className="size-10" />;
	return (
		<Button
			size="icon"
			variant="ghost"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
			aria-label={t("nav.toggleTheme")}
		>
			{resolvedTheme === "dark" ? <Sun /> : <Moon />}
		</Button>
	);
}

export function MarketingNavbar() {
	const t = useTranslations();
	const pathname = usePathname();
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const handler = () => setScrolled(window.scrollY > 10);
		handler();
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

	const close = () => setOpen(false);
	const mobileLinkClass = (href: string) =>
		cn(
			"flex items-center gap-2 rounded-2xl px-4 py-3 font-semibold text-base transition-colors",
			isActive(pathname, href)
				? "bg-muted text-foreground"
				: "text-muted-foreground hover:bg-accent hover:text-foreground",
		);

	return (
		<header className="fixed inset-x-0 top-3.5 z-50 px-4 sm:px-6">
			<nav
				className={cn(
					"mx-auto grid h-[3.75rem] max-w-[70rem] grid-cols-[1fr_auto] items-center gap-3 rounded-full bg-card/80 pr-2.5 pl-[1.125rem] ring-1 ring-foreground/5 backdrop-blur-[14px] backdrop-saturate-[1.4] transition-shadow duration-300 ease-out motion-reduce:transition-none lg:grid-cols-[1fr_auto_1fr] dark:ring-foreground/10",
					scrolled || open ? "shadow-lg" : "shadow-md",
				)}
			>
				<Link
					href="/"
					className="flex w-fit shrink-0 items-center gap-2.5 rounded-full"
				>
					<BrandLogo
						size="xl"
						alt={config.app.name}
						className="size-[1.625rem] dark:invert"
					/>
					<span className="font-extrabold font-heading text-[1.0625rem] text-foreground tracking-heading">
						{config.app.name}
					</span>
				</Link>

				<NavLinks />

				<div className="flex items-center justify-end gap-1">
					<div className="hidden items-center gap-1 lg:flex">
						<LocaleSwitcher />
						<ThemeToggle />
						<Button variant="ghost" asChild>
							<a href={urls.auth.signIn}>{t("nav.signIn")}</a>
						</Button>
					</div>
					<Button
						className="hidden h-[2.625rem] px-5 font-bold shadow-md sm:inline-flex"
						asChild
					>
						<a href={urls.auth.signUp}>
							{t("nav.startFree")}
							<ArrowRight />
						</a>
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="lg:hidden"
						onClick={() => setOpen((v) => !v)}
						aria-label={t("nav.toggleMenu")}
						aria-expanded={open}
					>
						{open ? <X /> : <Menu />}
					</Button>
				</div>
			</nav>

			{/* Mobile menu */}
			<div
				inert={!open}
				className={cn(
					"overflow-hidden transition-[max-height,opacity] duration-300 ease-out motion-reduce:transition-none lg:hidden",
					open
						? "max-h-[calc(100svh-5.5rem)] opacity-100"
						: "max-h-0 opacity-0",
				)}
			>
				<div className="mx-auto mt-2 mb-4 max-h-[calc(100svh-7rem)] max-w-[70rem] overflow-y-auto rounded-3xl bg-card p-3 shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">
					<div className="flex flex-col gap-1">
						{NAV_ITEMS.map((item) => (
							<SiteLink
								key={item.key}
								item={item}
								className={mobileLinkClass(item.href)}
								onNavigate={close}
							>
								{t(`nav.${item.key}`)}
								{item.badgeKey && <NewBadge badgeKey={item.badgeKey} />}
							</SiteLink>
						))}

						{DROPDOWN_ORDER.map((groupKey) => (
							<div key={groupKey} className="mt-2 rounded-2xl bg-muted p-2">
								<p className="px-2 pt-1 pb-2 font-bold font-heading text-foreground text-sm">
									{t(`nav.${groupKey}`)}
								</p>
								{DROPDOWN_GROUPS[groupKey].map((item) => {
									const Icon = item.icon;
									return (
										<SiteLink
											key={item.key}
											item={item}
											onNavigate={close}
											className="flex items-center gap-2.5 rounded-xl px-2 py-2.5 font-semibold text-foreground text-sm hover:bg-background"
										>
											<Icon className="size-4" />
											{t(`nav.${item.key}`)}
										</SiteLink>
									);
								})}
							</div>
						))}
					</div>
					<div className="mt-3 flex items-center gap-1 px-1">
						<LocaleSwitcher />
						<ThemeToggle />
					</div>
					<div className="mt-3 grid gap-2 sm:grid-cols-2">
						<Button variant="outline" asChild>
							<a href={urls.auth.signIn}>{t("nav.signIn")}</a>
						</Button>
						<Button asChild>
							<a href={urls.auth.signUp}>{t("nav.startFree")}</a>
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}
