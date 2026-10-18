"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { analyticsConfig } from "./config";
import { hasTrackingConsent, resolveAnalyticsProvider } from "./index";

/**
 * Loads the active analytics provider's script tag once tracking is
 * allowed — immediately for consent-free providers, otherwise only
 * after the user grants consent (GDPR). Subscribes to the
 * `fuutu:consent` event so it activates the moment the consent banner
 * is dismissed.
 *
 * Script injection is provider-driven via `getScriptProps()`.
 */
export function AnalyticsScript() {
	const [granted, setGranted] = useState(false);

	useEffect(() => {
		const read = () => {
			setGranted(hasTrackingConsent());
		};
		read();
		const handler = () => read();
		window.addEventListener(analyticsConfig.consentEventName, handler);
		return () =>
			window.removeEventListener(analyticsConfig.consentEventName, handler);
	}, []);

	if (!granted) return null;

	const provider = resolveAnalyticsProvider();
	const scriptProps = provider.getScriptProps?.();
	if (!scriptProps) return null;

	return (
		<Script
			src={scriptProps.src}
			strategy={scriptProps.strategy}
			{...(scriptProps.attributes ?? {})}
		/>
	);
}
