"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { analyticsConfig } from "./config";
import { readConsentCookie } from "./consent";
import { resolveAnalyticsProvider } from "./index";

/**
 * Loads the active analytics provider's script tag — only after the
 * user has granted consent (DSGVO). Reads consent from a shared cookie,
 * subscribes to the `fuutu:consent` event so it activates immediately
 * after the consent banner is dismissed.
 *
 * Script injection is provider-driven via `getScriptProps()`.
 */
export function AnalyticsScript() {
	const [granted, setGranted] = useState(false);

	useEffect(() => {
		const read = () => {
			setGranted(readConsentCookie() === "granted");
		};
		read();
		const handler = () => read();
		window.addEventListener(analyticsConfig.consentEventName, handler);
		return () =>
			window.removeEventListener(analyticsConfig.consentEventName, handler);
	}, []);

	if (analyticsConfig.requireConsent && !granted) return null;

	const scriptProps = resolveAnalyticsProvider().getScriptProps?.();
	if (!scriptProps) return null;

	return (
		<Script
			src={scriptProps.src}
			strategy={scriptProps.strategy}
			{...(scriptProps.attributes ?? {})}
		/>
	);
}
