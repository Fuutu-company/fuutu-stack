/**
 * @fuutu/logs/next/instrumentation — evlog Next.js instrumentation re-export.
 *
 * Usage in instrumentation.ts:
 * ```ts
 * import { defineNodeInstrumentation } from "@fuutu/logs/next/instrumentation";
 *
 * export const { register, onRequestError } = defineNodeInstrumentation({
 *   service: "saas",
 *   captureOutput: true,
 * });
 * ```
 */
export {
	type CaptureOutputOptions,
	type DefineNodeInstrumentationInput,
	defineNodeInstrumentation,
	type InstrumentationOptions,
	type NextInstrumentationErrorContext,
	type NextInstrumentationRequest,
	type NodeInstrumentationHooks,
	type NodeInstrumentationModule,
} from "evlog/next/instrumentation";
