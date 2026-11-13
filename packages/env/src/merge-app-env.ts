/**
 * Merge the app's env schemas (`app-env.ts`) into a kit schema group.
 * Throws at load when an app key reuses a kit key — it would otherwise be
 * validated by the kit schema instead of the app's, silently.
 */
export function mergeAppEnv<
	Kit extends Record<string, unknown>,
	App extends Record<string, unknown>,
>(kit: Kit, app: App, group: "server" | "client"): App & Kit {
	const collisions = Object.keys(app).filter((key) => Object.hasOwn(kit, key));
	if (collisions.length > 0) {
		throw new Error(
			`[@fuutu/env] packages/env/src/app-env.ts redefines kit ${group} env var(s): ${collisions.join(", ")}. The kit already defines them — rename your app var(s).`,
		);
	}
	return { ...app, ...kit };
}
