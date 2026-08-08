/** Returns a normalized YouTube embed URL, or null if not a YouTube link. */
export function toYouTubeEmbed(url: string): string | null {
	const yt =
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/;
	const m = url.match(yt);
	return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0&rel=0` : null;
}

/** Strip protocol and path from a URL, leaving only the hostname. */
export function toDisplayHost(url: string): string {
	return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}
