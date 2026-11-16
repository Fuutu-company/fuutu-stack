import { env } from "@fuutu/env/docs";
import { createFromSource } from "fumadocs-core/search/server";
import { guardSearch } from "@/lib/search-guard";
import { source } from "@/lib/source";

// `source` is i18n-enabled: createFromSource delegates to
// createI18nSearchAPI, which indexes per locale and filters by the
// `locale` query param. Per-locale `language` is deprecated — the
// default multilingual tokenizer covers every locale.
const search = createFromSource(source);

export const GET = guardSearch(search.GET, {
	trustProxyHeaders: env.TRUST_PROXY_HEADERS === true,
});
