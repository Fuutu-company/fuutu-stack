"use client";

import { openConsentBanner } from "@fuutu/analytics/consent";
import { Slot } from "@radix-ui/react-slot";
import type { ReactElement } from "react";

/** Kit footer action: the "Privacy settings" button reopens the consent banner. */
export function PrivacySettingsAction({ trigger }: { trigger: ReactElement }) {
	// Slot, not cloneElement: a trigger from a server component can arrive
	// as a lazy element in dev, which cloneElement turns into `undefined`.
	return <Slot onClick={openConsentBanner}>{trigger}</Slot>;
}
