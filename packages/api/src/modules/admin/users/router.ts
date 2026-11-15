import { banUserProcedure } from "./procedures/ban";
import { deleteUserProcedure } from "./procedures/delete";
import { getUserProcedure } from "./procedures/get";
import { impersonateUserProcedure } from "./procedures/impersonate";
import { listUsersProcedure } from "./procedures/list";
import { resetTwoFactorProcedure } from "./procedures/reset-two-factor";
import { revokeAllUserSessionsProcedure } from "./procedures/revoke-all-sessions";
import { revokeUserSessionProcedure } from "./procedures/revoke-session";
import { sendPasswordResetProcedure } from "./procedures/send-password-reset";
import { setUserRoleProcedure } from "./procedures/set-role";
import { unbanUserProcedure } from "./procedures/unban";
import { updateUserProcedure } from "./procedures/update";

export const adminUsersRouter = {
	list: listUsersProcedure,
	get: getUserProcedure,
	update: updateUserProcedure,
	ban: banUserProcedure,
	unban: unbanUserProcedure,
	setRole: setUserRoleProcedure,
	revokeSession: revokeUserSessionProcedure,
	revokeAllSessions: revokeAllUserSessionsProcedure,
	sendPasswordReset: sendPasswordResetProcedure,
	resetTwoFactor: resetTwoFactorProcedure,
	delete: deleteUserProcedure,
	impersonate: impersonateUserProcedure,
};
