"use client";

import { env } from "@fuutu/env/marketing";
import { BrandLogo, Button } from "@fuutu/ui";
import { LocaleSwitcher } from "@shared/components";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { memo, useEffect, useRef, useState } from "react";
import { defaultLocale } from "@/i18n/config";
import { handleHashClick } from "@/lib/utils";
import { Link, usePathname, useRouter } from "@/navigation";

const SAAS_URL = "https://stackapp.fuutu.com";
const DOCS_URL = "https://stack.fuutu.com/docs";

type NavItem = {
	key: string;
	href: string;
	external?: boolean;
	hash?: boolean;
	badgeKey?: string;
};

const NAV_ITEMS: NavItem[] = [
	{ key: "features", href: "/#features", hash: true },
	{ key: "pricing", href: "/pricing" },
	{ key: "blog", href: "/blog" },
	{ key: "changelog", href: "/changelog", badgeKey: "new" },
	{ key: "docs", href: DOCS_URL, external: true },
];

function isActive(pathname: string, href: string): boolean {
	if (href === "/#features") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}

const NavLinks = memo(function NavLinks() {
	const t = useTranslations();
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();
	const linkRefs = useRef<(HTMLElement | null)[]>([]);
	const [underline, setUnderline] = useState({
		left: 0,
		width: 0,
		show: false,
	});

	useEffect(() => {
		const idx = NAV_ITEMS.findIndex((item) => isActive(pathname, item.href));
		if (idx >= 0 && linkRefs.current[idx]) {
			const el = linkRefs.current[idx];
			setUnderline({ left: el.offsetLeft, width: el.offsetWidth, show: true });
		} else {
			setUnderline((prev) => ({ ...prev, show: false }));
		}
	}, [pathname]);

	const navLinkClass = (href: string) => {
		const active = isActive(pathname, href);
		return [
			"relative px-3 py-1.5 text-sm transition-colors",
			active
				? "font-medium text-foreground"
				: "text-muted-foreground hover:text-foreground",
		].join(" ");
	};

	return (
		<div className="relative hidden items-center gap-1 md:flex">
			{NAV_ITEMS.map((item, i) => {
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
					linkRefs.current[i] = el;
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
					>
						{content}
					</Link>
				);
			})}
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
					? "border-border border-b bg-background shadow-sm"
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
						<a href={`${SAAS_URL}/auth/sign-in`}>{t("nav.signIn")}</a>
					</Button>
					<Button size="sm" className="rounded-full shadow-sm" asChild>
						<a href={`${SAAS_URL}/auth/sign-up`}>{t("nav.getStarted")}</a>
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
					open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0",
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
					</div>
					<div className="mt-4 flex flex-col gap-2 border-border/40 border-t pt-4">
						<div className="flex items-center justify-between">
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
						<Button variant="outline" className="w-full" asChild>
							<a href={`${SAAS_URL}/auth/sign-in`}>{t("nav.signIn")}</a>
						</Button>
						<Button className="w-full" asChild>
							<a href={`${SAAS_URL}/auth/sign-up`}>{t("nav.getStarted")}</a>
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}
