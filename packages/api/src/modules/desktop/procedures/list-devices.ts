import { desktopOAuth } from "@fuutu/auth/desktop-oauth";
import { listDesktopDevices } from "@fuutu/db";
import { desktopConfig } from "@fuutu/desktop/config";
import { z } from "zod";
import { authProcedure, desktopAccessFlow } from "../../../orpc/procedures";
import { assertDesktopCaller } from "../guards";

const deviceSchema = z.object({
	id: z.string(),
	signedInAt: z.date(),
	lastActiveAt: z.date(),
	expiresAt: z.date(),
});

/** The caller's signed-in desktop installs. */
export const listDesktopDevicesProcedure = authProcedure()
	.use(desktopAccessFlow)
	.route({
		method: "GET",
		path: "/desktop/devices",
		tags: ["Desktop"],
		summary: "List desktop devices",
		description: "Signed-in desktop app installs of the current user.",
	})
	.output(
		z.object({
			devices: z.array(deviceSchema),
			limit: z.int().nullable(),
		}),
	)
	.handler(async ({ context }) => {
		assertDesktopCaller(context);
		return {
			devices: await listDesktopDevices(context.user.id, desktopOAuth.clientId),
			limit: desktopConfig.devices.limit,
		};
	});
