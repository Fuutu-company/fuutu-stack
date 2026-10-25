/** Returns a normalized YouTube embed URL, or null if not a YouTube link. */
export function toYouTubeEmbed(url: string): string | null {
	const yt =
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/;
	const m = url.match(yt);
	return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0&rel=0` : null;
}

/**
 * Returns the URL if it is safe to embed in an iframe (http/https only),
 * otherwise null. Blocks javascript:/data:/file: etc. — callers should
 * degrade to the placeholder when this returns null.
 */
export function toSafeIframeUrl(url: string): string | null {
	try {
		const protocol = new URL(url).protocol;
		return protocol === "https:" || protocol === "http:" ? url : null;
	} catch {
		return null;
	}
}

/** Strip protocol and path from a URL, leaving only the hostname. */
export function toDisplayHost(url: string): string {
	return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

/**
 * Resolve the filename shown in chrome titlebars / used as embed title.
 * Fallback order: explicit filename → image basename → generic video name →
 * iframe host → default.
 */
export function resolveAutoFilename(opts: {
	filename?: string;
	imageSrc?: string;
	videoSrc?: string;
	iframeSrc?: string;
}): string {
	if (opts.filename) return opts.filename;
	if (opts.imageSrc) return opts.imageSrc.split("/").pop() ?? "app.localhost";
	if (opts.videoSrc) return "video.embed";
	if (opts.iframeSrc) return toDisplayHost(opts.iframeSrc);
	return "app.localhost";
}
