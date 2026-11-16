import { config } from "@fuutu/config";
import { env } from "@fuutu/env/marketing";
import { appUrls } from "../app-urls";

const marketingBase = env.NEXT_PUBLIC_MARKETING_URL ?? "https://fuutustack.com";
const docsBase = env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.fuutustack.com";
const appBase = env.NEXT_PUBLIC_SAAS_URL ?? "https://app.fuutustack.com";

/** App URL values (`app-urls.ts`): a URL or a group of named URLs. */
export type AppUrls = Readonly<
	Record<string, string | Readonly<Record<string, string>>>
>;

const kitUrls = {
	marketing: marketingBase,
	docs: docsBase,
	app: appBase,
	github: config.app.contact.githubUrl,
	/** The demo's live design system page (tokens, areas, components). */
	design: `${appBase}/design`,
	auth: {
		signIn: `${appBase}/auth/sign-in`,
		signUp: `${appBase}/auth/sign-up`,
	},
} as const;

/** Marketing URLs: the kit set with the app's (`app-urls.ts`) merged over it. */
export const urls: Omit<typeof kitUrls, keyof typeof appUrls> & typeof appUrls =
	{ ...kitUrls, ...appUrls };
