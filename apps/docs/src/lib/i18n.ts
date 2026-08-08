import { defineI18n } from "fumadocs-core/i18n";
import { defaultLocale, locales } from "@/i18n/config";

export const i18n = defineI18n({
	defaultLanguage: defaultLocale,
	languages: locales,
	hideLocale: "default-locale",
	parser: "dir",
});
