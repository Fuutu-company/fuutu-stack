export function scrollToHash(hash: string, maxAttempts = 90): void {
	let attempts = 0;
	const tryScroll = () => {
		const el = document.getElementById(hash);
		if (el) {
			el.scrollIntoView({ behavior: "smooth" });
		} else if (attempts++ < maxAttempts) {
			requestAnimationFrame(tryScroll);
		}
	};
	requestAnimationFrame(tryScroll);
}

export function handleHashClick(
	e: React.MouseEvent,
	href: string,
	pathname: string,
	router: { push(href: string): void },
): void {
	e.preventDefault();
	const hash = href.split("#")[1];
	if (!hash) return;
	if (pathname === "/") {
		history.pushState(null, "", `#${hash}`);
		document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
		window.dispatchEvent(new HashChangeEvent("hashchange"));
	} else {
		router.push("/");
		scrollToHash(hash);
	}
}
