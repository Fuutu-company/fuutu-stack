import { env } from "@fuutu/env/saas";

/**
 * Base URL of the public SaaS app — used for links in auth emails and
 * the passkey relying-party ID.
 */
export const saasBaseUrl = env.NEXT_PUBLIC_SAAS_URL ?? "http://localhost:3000";
