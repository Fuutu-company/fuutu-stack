"use server";

import { i18nConfig } from "@fuutu/i18n/config";
import { cookies } from "next/headers";
import { z } from "zod";

const localeSchema = z.enum(
	Object.keys(i18nConfig.locales) as [string, ...string[]],
);

export async function setUserLocale(raw: unknown) {
	const locale = localeSchema.parse(raw);
	const cookieStore = await cookies();
	cookieStore.set(i18nConfig.localeCookieName, locale, {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
	});
}
