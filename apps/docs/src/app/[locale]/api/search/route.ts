import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// `source` is i18n-enabled: createFromSource delegates to
// createI18nSearchAPI, which indexes per locale and filters by the
// `locale` query param. Per-locale `language` is deprecated — the
// default multilingual tokenizer covers every locale.
export const { GET } = createFromSource(source);
