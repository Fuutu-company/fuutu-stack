import { i18nConfig } from "@fuutu/i18n/config";
import { publicProcedure } from "..";

function getCookieFromHeaders(headers: Headers, name: string): string | null {
	const cookieHeader = headers.get("cookie");
	if (!cookieHeader) return null;

	const cookies = cookieHeader.split(";").map((c) => c.trim());
	for (const cookie of cookies) {
		const [key, value] = cookie.split("=");
		if (key === name) return value ?? null;
	}
	return null;
}

export const localeMiddleware = publicProcedure.use(
	async ({ context, next }) => {
		const locale =
			getCookieFromHeaders(context.headers, i18nConfig.localeCookieName) ??
			i18nConfig.defaultLocale;

		return next({
			context: {
				locale,
			},
		});
	},
);
