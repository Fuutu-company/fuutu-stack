import { getPaymentsWebhookHandler } from "@fuutu/payments";
import type { NextRequest } from "next/server";

/**
 * Fuutu-owned payments webhook.
 *
 * Complementary to Better-Auth's own Polar webhook at
 * `/api/auth/polar/webhooks` (which handles auth-linked events:
 * subscription lifecycle, seat counts). This endpoint owns the
 * business-logic subset — refunds, custom metadata, domain-event
 * fanout — and is swap-safe across payment providers because it
 * resolves the active handler through `@fuutu/payments`.
 */
export async function POST(request: NextRequest) {
	const handler = getPaymentsWebhookHandler();
	return handler(request);
}
