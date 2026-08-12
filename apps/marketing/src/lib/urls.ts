import { config } from "@fuutu/config";
import { env } from "@fuutu/env/marketing";

const marketingBase =
	env.NEXT_PUBLIC_MARKETING_URL ?? "https://stack.fuutu.com";
const docsBase = env.NEXT_PUBLIC_DOCS_URL ?? "https://stack.fuutu.com/docs";
const appBase = env.NEXT_PUBLIC_SAAS_URL ?? "https://stackapp.fuutu.com";

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
