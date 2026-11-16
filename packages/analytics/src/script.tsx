"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { analyticsConfig } from "./config";
import { needsReloadOnConsentChange } from "./consent-withdrawal";
import { hasTrackingConsent, resolveAnalyticsProvider } from "./index";

/**
 * Loads the active analytics provider's script tag once tracking is
 * allowed — immediately for consent-free providers, otherwise only
 * after the user grants consent (GDPR). Subscribes to the
 * `fuutu:consent` event so it activates the moment the consent banner
 * is dismissed.
 *
 * Script injection is provider-driven via `getScriptProps()`.
 *
 * Withdrawing consent stops a loaded script: through the provider's
 * `installConsentGate`, or — for a provider without one — by reloading
 * the page, which then injects no script.
 */
export function AnalyticsScript() {
	const [granted, setGranted] = useState(false);
	const grantedRef = useRef(false);

	useEffect(() => {
		const provider = resolveAnalyticsProvider();
		// Before the script loads: an opt-out must also stop a loaded script.
		provider.installConsentGate?.(hasTrackingConsent);
		const read = () => {
			const next = hasTrackingConsent();
			if (needsReloadOnConsentChange(provider, grantedRef.current, next)) {
				window.location.reload();
				return;
			}
			grantedRef.current = next;
			setGranted(next);
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
