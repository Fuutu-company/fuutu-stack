/** Hosts a seed script may talk to: this machine. */
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/**
 * The compose database service. Inside a deployed compose stack it is the
 * production database, so it counts as local only when the operator says
 * so (`FUUTU_ALLOW_SEED=1`, e.g. a local compose rehearsal).
 */
export const COMPOSE_DB_HOST = "postgres";

/** Throw unless `value` is a URL whose host is local. */
export function assertLocalHost(
	value: string,
	what: string,
	options: { allowComposeHost?: boolean } = {},
): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`Refusing to seed: the ${what} is not a valid URL.`);
	}
	const local =
		LOCAL_HOSTS.includes(url.hostname) ||
		(options.allowComposeHost === true && url.hostname === COMPOSE_DB_HOST);
	if (!local) {
		throw new Error(
			`Refusing to seed against a non-local ${what} (${url.hostname}).`,
		);
	}
	return url;
}
