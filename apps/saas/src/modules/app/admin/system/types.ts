import type { AppRouterClient } from "@fuutu/api";

export type AdminSystemStatusData = Awaited<
	ReturnType<AppRouterClient["admin"]["system"]["status"]>
>;
