import { config } from "@fuutu/config";
import { env } from "@fuutu/env/marketing";

const marketingBase =
	env.NEXT_PUBLIC_MARKETING_URL ?? "https://fuutustack.com";
const docsBase = env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.fuutustack.com";
const appBase = env.NEXT_PUBLIC_SAAS_URL ?? "https://app.fuutustack.com";

export const urls = {
	marketing: marketingBase,
	docs: docsBase,
	app: appBase,
	github: config.app.contact.githubUrl,
	auth: {
		signIn: `${appBase}/auth/sign-in`,
		signUp: `${appBase}/auth/sign-up`,
	},
} as const;
