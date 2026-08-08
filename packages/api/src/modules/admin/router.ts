import { listAuditLogsProcedure } from "./procedures/list-audit-logs";

export const adminRouter = {
	auditLogs: {
		list: listAuditLogsProcedure,
	},
};
