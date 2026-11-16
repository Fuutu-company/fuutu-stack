import { adminOrganizationsRouter } from "./organizations/router";
import { listAuditLogsProcedure } from "./procedures/list-audit-logs";
import { stopImpersonatingProcedure } from "./procedures/stop-impersonating";
import { adminSystemRouter } from "./system/router";
import { adminUsersRouter } from "./users/router";

export const adminRouter = {
	auditLogs: {
		list: listAuditLogsProcedure,
	},
	users: adminUsersRouter,
	organizations: adminOrganizationsRouter,
	system: adminSystemRouter,
	impersonation: {
		stop: stopImpersonatingProcedure,
	},
};
