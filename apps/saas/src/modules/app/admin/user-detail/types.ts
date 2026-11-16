import type { AppRouterClient } from "@fuutu/api";

export type AdminUserDetailData = Awaited<
	ReturnType<AppRouterClient["admin"]["users"]["get"]>
>;
