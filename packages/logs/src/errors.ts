/**
 * @fuutu/logs/errors — evlog structured errors re-export.
 *
 * Usage:
 * ```ts
 * import { createError, parseError } from "@fuutu/logs/errors";
 *
 * throw createError({
 *   code: "PAYMENT_DECLINED",
 *   message: "Payment failed",
 *   status: 402,
 *   why: "Card declined by issuer",
 *   fix: "Try a different payment method",
 * });
 * ```
 */

export type { ErrorOptions, EvlogError, ParsedError } from "evlog";
export {
	createError,
	createError as createEvlogError,
	parseError,
} from "evlog";
