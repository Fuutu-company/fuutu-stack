import { featureRouter } from "../../orpc/middleware/require-feature";
import { listDesktopDevicesProcedure } from "./procedures/list-devices";
import { revokeDesktopDeviceProcedure } from "./procedures/revoke-device";
import { desktopSessionProcedure } from "./procedures/session";

/** Off with `config.features.desktop` (NOT_FOUND). */
export const desktopRouter = featureRouter("desktop", {
	session: desktopSessionProcedure,
	devices: {
		list: listDesktopDevicesProcedure,
		revoke: revokeDesktopDeviceProcedure,
	},
});
