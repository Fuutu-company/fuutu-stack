import { listAuditLogsProcedure } from "./procedures/list-audit-logs";
import { stopImpersonatingProcedure } from "./procedures/stop-impersonating";
import { adminUsersRouter } from "./users/router";

export const adminRouter = {
	auditLogs: {
		list: listAuditLogsProcedure,
	},
	users: adminUsersRouter,
	impersonation: {
		stop: stopImpersonatingProcedure,
	},
};
