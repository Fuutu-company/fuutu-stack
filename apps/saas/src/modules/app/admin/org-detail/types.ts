import type { AppRouterClient } from "@fuutu/api";

export type AdminOrganizationDetailData = Awaited<
	ReturnType<AppRouterClient["admin"]["organizations"]["get"]>
>;

export type AdminOrganizationListData = Awaited<
	ReturnType<AppRouterClient["admin"]["organizations"]["list"]>
>;

export type AdminOrganizationListItem =
	AdminOrganizationListData["items"][number];

export type AdminOrganizationMember =
	AdminOrganizationDetailData["members"][number];

export type AdminOrganizationInvitation =
	AdminOrganizationDetailData["invitations"][number];
