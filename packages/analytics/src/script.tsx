"use client";

import { createLogger } from "@fuutu/logs";
import Script from "next/script";
import { useEffect, useState } from "react";
import { analyticsConfig } from "./config";
import { readConsentCookie } from "./consent";

const log = createLogger({ scope: "analytics:script" });

const DEFAULT_UMAMI_SCRIPT = "https://cloud.umami.is/script.js";

/**
 * Loads the active analytics provider's script tag — only after the
 * user has granted consent (DSGVO). Reads consent from a shared cookie,
 * subscribes to the `fuutu:consent` event so it activates immediately
 * after the consent banner is dismissed.
 *
 * v1: Umami only. Skeleton providers render nothing.
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
	if (analyticsConfig.provider !== "umami") {
		if (analyticsConfig.provider !== "noop") {
			log.warn(
				`provider "${analyticsConfig.provider}" is configured but no script loader is implemented in v1; analytics will silently no-op. Add a loader or switch to "umami"/"noop".`,
			);
		}
		return null;
	}
	if (!analyticsConfig.websiteId) return null;

	const src = analyticsConfig.scriptUrl ?? DEFAULT_UMAMI_SCRIPT;

	return (
		<Script
			src={src}
			data-website-id={analyticsConfig.websiteId}
			strategy="afterInteractive"
			defer
		/>
	);
}
