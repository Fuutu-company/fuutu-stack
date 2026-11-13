import { getCreditBalanceSummary } from "@fuutu/credits";
import {
	countApiKeys,
	countOrgApiKeys,
	countOrganizationMembers,
	countOrganizationsForUser,
	countWebhooks,
	findAuditLogsByOrg,
	getActiveSubscriptionForOrganization,
	getActiveSubscriptionForUser,
	getCreditEventsForOrganization,
	getCreditEventsForUser,
	listApiKeys,
	listAuditLogDates,
	listAuditLogs,
	listInvoicesByOrg,
	listInvoicesByUser,
	listOrgApiKeys,
} from "@fuutu/db";
import { getOrgEntitlement, getUserEntitlement } from "@fuutu/payments";
import {
	CREDITS,
	type LimitValue,
	type PlanId,
	paymentsConfig,
} from "@fuutu/payments/config";
import {
	hasOrgPermission,
	hasSystemPermission,
	type KnownPermission,
	ORG_POLICY,
	OrgAccessControl,
	PERMISSIONS,
	SYSTEM_POLICY,
	SystemAccessControl,
} from "@fuutu/rbac";
import { z } from "zod";
import { authProcedure } from "../../../orpc/procedures";
import {
	type ActivityDay,
	type ActivityEvent,
	activityWindowStart,
	buildActivitySeries,
} from "../activity-series";
import {
	apiKeyFeedItem,
	areaForAuditAction,
	auditFeedItem,
	creditFeedItem,
	FEED_MAX,
	type FeedItem,
	invoiceEventAt,
	invoiceFeedItem,
	isCreditConsumption,
	mergeFeed,
} from "../feed";

const systemAC = new SystemAccessControl(SYSTEM_POLICY);
const orgAC = new OrgAccessControl(ORG_POLICY);

/** Rows read per non-audit source for the 30-day series (newest first). */
const SERIES_SOURCE_TAKE = 200;
const AI_METER = "ai_tokens";

export type DashboardOverview = {
	scope: "user" | "organization";
	planId: PlanId;
	users:
		| { kind: "members"; count: number; limit: LimitValue }
		| { kind: "organizations"; count: number; limit: LimitValue };
	billing: { planId: PlanId; renewsAt: string | null } | null;
	credits: {
		meterKey: typeof AI_METER;
		remaining: number;
		granted: number;
		included: LimitValue;
	} | null;
	api: {
		apiKeys: number;
		apiKeyLimit: LimitValue;
		webhooks: number | null;
		webhookLimit: LimitValue;
	} | null;
	activity: { days: ActivityDay[] };
	feed: FeedItem[];
};

const overviewSchema = z.object({
	organizationId: z.string().min(1).optional(),
});

export const dashboardOverviewProcedure = authProcedure({
	systemPermission: PERMISSIONS.ACTIVITY.VIEW,
	org: { permission: PERMISSIONS.ORGANIZATION.VIEW, optional: true },
})
	.route({
		method: "GET",
		path: "/dashboard/overview",
		tags: ["Dashboard"],
		summary: "Dashboard overview",
		description:
			"KPIs, plan usage, a 30-day activity series and a recent-activity feed for the current user or an organization. Each section is null when the caller's role lacks its permission.",
	})
	.input(overviewSchema)
	.handler(async ({ context }): Promise<DashboardOverview> => {
		const { org, orgRole, systemRole, user } = context;
		// Sub-permissions follow the same scope rule as the authorize
		// middleware: org role inside an org, system role otherwise.
		const can = (permission: KnownPermission) =>
			org
				? hasOrgPermission(orgAC, orgRole, permission)
				: hasSystemPermission(systemAC, systemRole, permission);
		const owner = org ? { organizationId: org.id } : { userId: user.id };
		// Without AUDIT_LOG.VIEW a member sees only their own rows — inside
		// an org restricted to that org (never personal or other-org rows).
		const ownAuditScope = org
			? { organizationId: org.id, userId: user.id }
			: { userId: user.id };
		const now = new Date();
		const since = activityWindowStart(now);

		const canAuditOrg = Boolean(org) && can(PERMISSIONS.AUDIT_LOG.VIEW);
		const canOwnActivity = can(PERMISSIONS.ACTIVITY.VIEW);
		const canBilling = can(PERMISSIONS.PAYMENT.VIEW);
		const canCredits =
			paymentsConfig.creditsEnabled && can(PERMISSIONS.CREDIT.VIEW);
		const canApi = can(PERMISSIONS.API_KEY.VIEW);
		const canWebhooks = Boolean(org) && can(PERMISSIONS.WEBHOOK.VIEW);

		const [
			entitlement,
			userCount,
			subscription,
			creditSummary,
			apiKeyCount,
			webhookCount,
			auditRows,
			auditDates,
			invoices,
			apiKeys,
			creditEvents,
		] = await Promise.all([
			org ? getOrgEntitlement(org.id) : getUserEntitlement(user.id),
			org
				? countOrganizationMembers(org.id)
				: countOrganizationsForUser(user.id),
			canBilling
				? org
					? getActiveSubscriptionForOrganization(org.id)
					: getActiveSubscriptionForUser(user.id)
				: null,
			canCredits ? getCreditBalanceSummary(owner) : null,
			canApi
				? org
					? countOrgApiKeys(org.id)
					: countApiKeys(user.id, { personalOnly: true })
				: null,
			canWebhooks && org ? countWebhooks(org.id) : null,
			canAuditOrg && org
				? findAuditLogsByOrg(org.id, { take: FEED_MAX })
				: canOwnActivity
					? listAuditLogs({ ...ownAuditScope, take: FEED_MAX })
					: [],
			canAuditOrg && org
				? listAuditLogDates({ organizationId: org.id, since })
				: canOwnActivity
					? listAuditLogDates({ ...ownAuditScope, since })
					: [],
			canBilling
				? org
					? listInvoicesByOrg(org.id, { take: SERIES_SOURCE_TAKE })
					: listInvoicesByUser(user.id, {
							take: SERIES_SOURCE_TAKE,
							personalOnly: true,
						})
				: [],
			canApi
				? org
					? listOrgApiKeys(org.id, { take: SERIES_SOURCE_TAKE })
					: listApiKeys(user.id, {
							take: SERIES_SOURCE_TAKE,
							personalOnly: true,
						})
				: [],
			canCredits
				? org
					? getCreditEventsForOrganization(org.id, SERIES_SOURCE_TAKE)
					: getCreditEventsForUser(user.id, SERIES_SOURCE_TAKE)
				: [],
		]);

		const { planId, limits } = entitlement;
		const consumption = creditEvents.filter(isCreditConsumption);
		const aiBalance = creditSummary?.find((s) => s.meterKey === AI_METER);

		const events: ActivityEvent[] = [
			...auditDates.map((row) => ({
				area: areaForAuditAction(row.action),
				at: row.createdAt,
			})),
			...invoices.flatMap((invoice) => {
				const at = invoiceEventAt(invoice);
				return at ? [{ area: "billing" as const, at }] : [];
			}),
			...apiKeys.map((key) => ({ area: "api" as const, at: key.createdAt })),
			...consumption.map((event) => ({
				area: "ai" as const,
				at: event.createdAt,
			})),
		];

		return {
			scope: org ? "organization" : "user",
			planId,
			users: org
				? { kind: "members", count: userCount, limit: limits.membersPerOrg }
				: {
						kind: "organizations",
						count: userCount,
						limit: limits.organizations,
					},
			billing: canBilling
				? {
						planId,
						renewsAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
					}
				: null,
			credits: canCredits
				? {
						meterKey: AI_METER,
						remaining: aiBalance?.total ?? 0,
						granted:
							(aiBalance?.recurring.granted ?? 0) +
							(aiBalance?.topups.total ?? 0),
						included: CREDITS[planId]?.[AI_METER] ?? 0,
					}
				: null,
			api:
				apiKeyCount === null
					? null
					: {
							apiKeys: apiKeyCount,
							apiKeyLimit: limits.apiKeys,
							webhooks: webhookCount,
							webhookLimit: limits.webhooks,
						},
			activity: { days: buildActivitySeries(events, now) },
			feed: mergeFeed([
				auditRows.map(auditFeedItem),
				invoices.flatMap((invoice) => invoiceFeedItem(invoice) ?? []),
				apiKeys.slice(0, FEED_MAX).map(apiKeyFeedItem),
				consumption.slice(0, FEED_MAX).map(creditFeedItem),
			]),
		};
	});
