import { handlePaymentsWebhook } from "@fuutu/payments";
import type { NextRequest } from "next/server";

/**
 * Fuutu-owned payments webhook entry point.
 *
 * Provider-agnostic: resolves the active provider, verifies the webhook
 * signature, parses the payload into normalized `ProviderEvent[]`, and
 * syncs them to the `Purchase` table via the shared `WebhookSync` layer.
 *
 * Configure your provider's webhook endpoint to point here:
 *   Stripe: https://your-domain.com/api/webhooks/payments
 *   Creem:  https://your-domain.com/api/webhooks/payments
 *   Polar:  https://your-domain.com/api/webhooks/payments
 */
export async function POST(request: NextRequest) {
	return handlePaymentsWebhook(request);
}
