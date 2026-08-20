// Barrel export for simpler imports
export { createRateLimitMiddleware } from "./middleware/rate-limit";
export {
	adminProcedure,
	permissionProcedure,
	protectedProcedure,
	publicProcedure,
} from "./procedures";
export type { AppRouter, AppRouterClient } from "./router";
export { appRouter, router } from "./router";
