// Fetch stub for ping-bin.test.ts — loaded via `node --import` before
// bin/ping.mjs. Prints the request (URL + JSON body) instead of sending it.
globalThis.fetch = async (url, init) => {
	process.stdout.write(
		`PING ${JSON.stringify({ url: String(url), body: JSON.parse(init.body) })}\n`,
	);
	return new Response("ok", { status: 200 });
};
