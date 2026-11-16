import { config } from "@fuutu/config";
import type { EvlogOrpcContext } from "@fuutu/logs/orpc";
import { paymentsConfig } from "@fuutu/payments/config";
import { type ContractRouter, ORPCError, os, type Router } from "@orpc/server";
import type { Context } from "../../context";

/**
 * Modules a `config.features` flag can switch off. Off means gone: the
 * pages 404 and every procedure of the module's router answers
 * NOT_FOUND — the sidebar link is not the only gate.
 */
export type GatedFeature = "aiChat" | "crm" | "credits" | "webhooks";

/** Read at call time, so a flag flip in tests or config applies per request. */
export function isFeatureEnabled(feature: GatedFeature): boolean {
	switch (feature) {
		case "aiChat":
			return config.features.aiChat;
		case "crm":
			return config.features.crm;
		case "webhooks":
			return config.features.webhooks;
		case "credits":
			// Derived from `config.features.credits`; apps may override it.
			return paymentsConfig.creditsEnabled;
	}
}

type ProcedureContext = Context & Partial<EvlogOrpcContext>;

const base = os.$context<ProcedureContext>();

/** Middleware: NOT_FOUND while `feature` is off. */
export function requireFeature(feature: GatedFeature) {
	return base.middleware(({ next }) => {
		if (!isFeatureEnabled(feature)) {
			throw new ORPCError("NOT_FOUND", { message: "Not found" });
		}
		return next();
	});
}

/**
 * Gate every procedure of `router` behind `feature`. The check runs
 * first — before auth — so a disabled module does not reveal itself.
 * Router shape and procedure types stay the same.
 */
export function featureRouter<
	T extends Router<ContractRouter<Record<never, never>>, ProcedureContext>,
>(feature: GatedFeature, router: T) {
	return base.use(requireFeature(feature)).router(router);
}
