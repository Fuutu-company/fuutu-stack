import { getMcpConsentRequest } from "@fuutu/auth/mcp-consent";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth-server";
import { OAuthConsent } from "@/modules/auth/components/oauth-consent";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth.consent");
	return {
		title: t("pageTitle"),
	};
}

/**
 * OAuth consent for MCP clients. Everything shown (client, redirect host,
 * organization) is read server-side from the provider-signed query — a
 * tampered or expired request renders the error state.
 */
export default async function ConsentPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [params, session] = await Promise.all([searchParams, getSession()]);
	const request = session
		? await getMcpConsentRequest(
				params,
				(session.session as { activeOrganizationId?: string | null })
					.activeOrganizationId,
			)
		: null;
	return <OAuthConsent request={request} />;
}
