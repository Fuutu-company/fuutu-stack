import type { i18nConfig } from "./config";
import type messages from "./translations/en/index";

export type Messages = typeof messages;
export type Locale = keyof (typeof i18nConfig)["locales"];
